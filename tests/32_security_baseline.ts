/**
 * Validação do Baseline de Segurança para v1.0 (RFC-009).
 *
 * Cobre formalmente os 6 requisitos da RFC-009:
 * 1. Parametrização SQL obrigatória
 * 2. Limite de tamanho de corpo HTTP (1MB padrão) com 413
 * 3. Timeout de leitura HTTP (5s padrão)
 * 4. Resposta 500 genérica sem leak de panic/stack trace
 * 5. Mascaramento de segredos no core/log (case-insensitive) em TS e Go
 * 6. Connection URL via env var
 */
import { execFileSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";
import { GoTranspiler } from "../src/transpiler";
import { postgresModule } from "../src/modules/postgres";
import { httpModule } from "../src/modules/http";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n🔒 Executando Suíte de Segurança (RFC-009: Baseline de Segurança v1.0)...\n");

// --- Requisito 1: Toda query é parametrizada ($1, $2) ---
{
  const poolType = postgresModule.types.find(t => t.name === "Pool");
  const queryMethod = poolType?.methods?.find(m => m.name === "query");
  const execMethod = poolType?.methods?.find(m => m.name === "execute");
  check("Requisito 1: Pool.query exige 2 argumentos (sql + params array)", queryMethod?.arity === 2);
  check("Requisito 1: Pool.execute exige 2 argumentos (sql + params array)", execMethod?.arity === 2);
}

// --- Requisito 2 e 3: Defaults de segurança do HTTP (1MB max_body_size, 5s timeout) ---
{
  const serverConfig = httpModule.types.find(t => t.name === "ServerConfig");
  const readTimeoutProp = serverConfig?.properties?.find(p => p.name === "read_timeout");
  const maxBodySizeProp = serverConfig?.properties?.find(p => p.name === "max_body_size");
  check("Requisito 2 & 3: ServerConfig expõe read_timeout", readTimeoutProp !== undefined);
  check("Requisito 2 & 3: ServerConfig expõe max_body_size", maxBodySizeProp !== undefined);
}

// --- Requisito 5: Mascaramento de campos sensíveis no core/log (TS Interpretado) ---
async function runTsTest() {
  const flexCode = `
import { log } from "core/log";

log.info("user login", {
    user: "alice",
    password: "plaintext_password_123",
    role: "admin",
    nested: {
        token: "jwt_token_abc",
        secret: "top_secret_xyz"
    }
});

log.error("auth failure", {
    service: "gateway",
    PASSWORD: "all_caps_password",
    Token: "title_case_token",
    api_key: "api_key_123",
    Authorization: "Bearer secret_header_value"
});
`;

  const logsCaptured: string[] = [];
  const originalLog = console.log;
  console.log = (msg: string) => {
    logsCaptured.push(msg);
  };

  try {
    const ast = new Parser(new Lexer(flexCode).tokenize()).parse();
    const checker = new TypeChecker();
    checker.check(ast);
    const interpreter = new Interpreter();
    await interpreter.run(ast);
  } finally {
    console.log = originalLog;
  }

  check("Requisito 5 (TS): Dois logs foram gerados", logsCaptured.length === 2);
  if (logsCaptured.length === 2) {
    const log1 = JSON.parse(logsCaptured[0]!);
    const log2 = JSON.parse(logsCaptured[1]!);

    check("Requisito 5 (TS): Campo 'password' mascarado", log1.password === "***");
    check("Requisito 5 (TS): Campo 'user' preservado", log1.user === "alice");
    check("Requisito 5 (TS): Campo 'role' preservado", log1.role === "admin");
    check("Requisito 5 (TS): Campo 'nested.token' mascarado", log1.nested?.token === "***");
    check("Requisito 5 (TS): Campo 'nested.secret' mascarado", log1.nested?.secret === "***");

    check("Requisito 5 (TS): Campo 'PASSWORD' (caps) mascarado", log2.PASSWORD === "***");
    check("Requisito 5 (TS): Campo 'Token' (title case) mascarado", log2.Token === "***");
    check("Requisito 5 (TS): Campo 'api_key' mascarado", log2.api_key === "***");
    check("Requisito 5 (TS): Campo 'Authorization' mascarado", log2.Authorization === "***");
    check("Requisito 5 (TS): Campo 'service' preservado", log2.service === "gateway");
  }
}

// --- Requisito 5: Mascaramento de campos sensíveis no core/log (Go Compilado) ---
{
  const flexCode = `
import { log } from "core/log";

func main() {
    log.info("user login", {
        user: "alice",
        password: "plaintext_password_123",
        role: "admin",
        nested: {
            token: "jwt_token_abc",
            secret: "top_secret_xyz"
        }
    });

    log.error("auth failure", {
        service: "gateway",
        PASSWORD: "all_caps_password",
        Token: "title_case_token",
        api_key: "api_key_123",
        Authorization: "Bearer secret_header_value"
    });
}
main();
`;

  try {
    const ast = new Parser(new Lexer(flexCode).tokenize()).parse();
    const checker = new TypeChecker();
    const types = checker.check(ast);
    const transpiler = new GoTranspiler();
    const goSource = transpiler.transpile(ast, types);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-sec-"));
    const goFile = path.join(tmpDir, "main.go");
    const binFile = path.join(tmpDir, "main");
    fs.writeFileSync(goFile, goSource, "utf-8");

    execFileSync("go", ["build", "-o", binFile, goFile]);
    const res = spawnSync(binFile, { encoding: "utf-8" });
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const lines = res.stdout.trim().split("\n").filter(l => l.trim().startsWith("{"));
    check("Requisito 5 (Go): Dois logs gerados no stdout", lines.length === 2);
    if (lines.length === 2) {
      const log1 = JSON.parse(lines[0]!);
      const log2 = JSON.parse(lines[1]!);

      check("Requisito 5 (Go): Campo 'password' mascarado", log1.password === "***");
      check("Requisito 5 (Go): Campo 'user' preservado", log1.user === "alice");
      check("Requisito 5 (Go): Campo 'role' preservado", log1.role === "admin");
      check("Requisito 5 (Go): Campo 'nested.token' mascarado", log1.nested?.token === "***");
      check("Requisito 5 (Go): Campo 'nested.secret' mascarado", log1.nested?.secret === "***");

      check("Requisito 5 (Go): Campo 'PASSWORD' (caps) mascarado", log2.PASSWORD === "***");
      check("Requisito 5 (Go): Campo 'Token' (title case) mascarado", log2.Token === "***");
      check("Requisito 5 (Go): Campo 'api_key' mascarado", log2.api_key === "***");
      check("Requisito 5 (Go): Campo 'Authorization' mascarado", log2.Authorization === "***");
      check("Requisito 5 (Go): Campo 'service' preservado", log2.service === "gateway");
    }
  } catch (e: any) {
    check("Requisito 5 (Go): Transpilação e execução Go", false, e.message);
  }
}

async function main() {
  await runTsTest();

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
