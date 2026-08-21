/**
 * Teste de integração HTTP Server Multipart & File Upload (RFC-046).
 *
 * Valida a paridade estrita entre o modo interpretado (Node.js) e compilado (Golang)
 * para o recebimento de formulários `multipart/form-data` e `application/x-www-form-urlencoded`.
 */
import * as http from "http";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync, spawn, type ChildProcess } from "child_process";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";
import { GoTranspiler } from "../src/transpiler";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ${green("[PASS]")} ${label}`);
    passed++;
  } else {
    console.log(`  ${red("[FAIL]")} ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function waitForServer(url: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw new Error(`Servidor em ${url} não respondeu em ${timeoutMs}ms (${String(lastError)})`);
}

const SERVER_SOURCE = (port: number) => `
import { Server, ServerConfig, Request, Response, UploadedFile } from "net/http";

func get_or(opt: Option<String>, fallback: String) -> String {
    match opt {
        Option.Some(v) {
            return v;
        }
        Option.None {
            return fallback;
        }
    }
    return fallback;
}

let mut server = Server.new(":${port}", ServerConfig { read_timeout: 5000, max_body_size: 5000000 });

server.post("/upload", |req, res| {
    let user_id = get_or(req.form_value("user_id"), "unknown");
    let file_opt = req.form_file("document");

    match file_opt {
        Option.Some(file) {
            res.json({
                "status": "ok",
                "user_id": user_id,
                "filename": file.filename,
                "size": file.size,
                "content": file.content
            });
        }
        Option.None {
            res.status(400).json({ "error": "missing document" });
        }
    }
});

server.post("/form", |req, res| {
    let name = get_or(req.form_value("name"), "anon");
    let email = get_or(req.form_value("email"), "no-email");
    res.json({
        "name": name,
        "email": email
    });
});

server.start();
`;

async function runTestsOnServer(baseUrl: string, modeName: string): Promise<void> {
  console.log(`\n🔍 Testando ${modeName} em ${baseUrl}...`);

  // 1. Teste de Upload Multipart com Campo de Texto e Arquivo
  const boundary = "---------------------------FlexLangMultipartBoundary123";
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="user_id"',
    "",
    "usr-789",
    `--${boundary}`,
    'Content-Disposition: form-data; name="document"; filename="contrato.txt"',
    "Content-Type: text/plain",
    "",
    "Conteudo confidencial do contrato Pix.",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const uploadRes = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const uploadText = await uploadRes.text();
  let uploadJson: any = {};
  try {
    uploadJson = JSON.parse(uploadText);
  } catch {}
  if (uploadRes.status !== 200) {
    console.error(`  [DEBUG] ${modeName} upload falhou (status ${uploadRes.status}):`, uploadText);
  }

  check(`${modeName}: Upload multipart retorna status 200`, uploadRes.status === 200);
  check(`${modeName}: user_id extraido corretamente via form_value`, uploadJson.user_id === "usr-789");
  check(`${modeName}: filename extraido corretamente via form_file`, uploadJson.filename === "contrato.txt");
  check(`${modeName}: content do arquivo recebido com exatidao`, uploadJson.content === "Conteudo confidencial do contrato Pix.");

  // 2. Teste de x-www-form-urlencoded
  const urlEncodedBody = "name=Alice&email=alice%40flexlang.org";
  const formRes = await fetch(`${baseUrl}/form`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: urlEncodedBody,
  });

  check(`${modeName}: Form urlencoded retorna status 200`, formRes.status === 200);
  const formJson = (await formRes.json()) as any;
  check(`${modeName}: form_value com urlencoded extrai 'name'`, formJson.name === "Alice");
  check(`${modeName}: form_value com urlencoded extrai 'email'`, formJson.email === "alice@flexlang.org");
}

async function main() {
  console.log("🧪 Iniciando bateria de testes de Paridade: HTTP Server Multipart (RFC-046)...\n");

  const tsPort = 18091;
  const goPort = 18092;

  // --- MODO INTERPRETADO (TS) ---
  console.log("▶ Iniciando Servidor Interpretado (TypeScript)...");
  const tsCode = SERVER_SOURCE(tsPort);
  const lexer = new Lexer(tsCode);
  const tokens = lexer.tokenize();
  const ast = new Parser(tokens, "server_ts.flex").parse();
  new TypeChecker().check(ast, "server_ts.flex");

  const interpreter = new Interpreter(() => {});
  void interpreter.run(ast).catch((e) => {
    console.error("Erro no interpretador:", e);
  });

  await waitForServer(`http://localhost:${tsPort}/healthz`);
  await runTestsOnServer(`http://localhost:${tsPort}`, "Modo Interpretado");

  // --- MODO COMPILADO (Golang) ---
  console.log("\n▶ Compilando e Iniciando Servidor Compilado (Golang)...");
  const goCode = SERVER_SOURCE(goPort);
  const goTokens = new Lexer(goCode).tokenize();
  const goAst = new Parser(goTokens, "server_go.flex").parse();
  const goTypes = new TypeChecker().check(goAst, "server_go.flex");

  const transpiler = new GoTranspiler();
  const generatedGo = transpiler.transpile(goAst, goTypes);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex_multipart_test_"));
  const mainGoPath = path.join(tmpDir, "main.go");
  fs.writeFileSync(mainGoPath, generatedGo);

  execFileSync("go", ["mod", "init", "multipart_test"], { cwd: tmpDir });
  const binPath = path.join(tmpDir, "server_bin");
  execFileSync("go", ["build", "-o", binPath, "main.go"], { cwd: tmpDir });

  const goProc: ChildProcess = spawn(binPath, [], { cwd: tmpDir, stdio: "inherit" });

  try {
    await waitForServer(`http://localhost:${goPort}/healthz`);
    await runTestsOnServer(`http://localhost:${goPort}`, "Modo Compilado (Go)");
  } finally {
    goProc.kill("SIGKILL");
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

  console.log(`\n========================================`);
  console.log(`Resultados: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro fatal no teste de integração:", err);
  process.exit(1);
});
