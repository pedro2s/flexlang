/**
 * Teste de integração HTTP real (RFC-004, "Plano de Testes" item 1 e 4).
 *
 * Diferente de `runner.ts`/`parity_runner.ts` (golden-file, sem I/O de rede),
 * este script sobe um `FlexServer` de verdade — em modo interpretado E
 * compilado, em portas diferentes — e dispara requisições HTTP reais via
 * `fetch`, comparando status e corpo contra o esperado. É o único jeito de
 * cobrir path params, query, corpo JSON e limite de tamanho, já que nenhum
 * golden test consegue simular uma requisição HTTP de fato.
 */
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
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

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
  throw new Error(`servidor em ${url} não respondeu em ${timeoutMs}ms (${String(lastError)})`);
}

/** Go pode não estar no PATH do shell que roda a suíte (ver parity_runner.ts). */
function findGo(): string | null {
  const candidates = [
    process.env.GO_BIN,
    "go",
    "/usr/local/go/bin/go",
    path.join(os.homedir(), "go", "bin", "go"),
    "/usr/lib/go/bin/go",
    "/snap/bin/go",
  ].filter((c): c is string => !!c);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["version"], { stdio: "pipe" });
      return candidate;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

async function runScenarios(base: string): Promise<void> {
  {
    const res = await fetch(`${base}/users/42`);
    const body = await res.json();
    check("GET /users/:id válido -> 200", res.status === 200, String(res.status));
    check("GET /users/:id válido -> corpo é o id", body === 42, JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/users/abc`);
    const body = await res.json();
    check("GET /users/:id inválido -> 400", res.status === 400, String(res.status));
    check("GET /users/:id inválido -> corpo tem 'error'", typeof body.error === "string", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/users/7?verbose=sim`);
    const body = await res.json();
    check("GET /users/:id?verbose= -> 200", res.status === 200, String(res.status));
    check("GET /users/:id?verbose= -> ecoa a query", body === "sim", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/users`, { method: "POST", body: JSON.stringify({ name: "Ana" }) });
    const body = await res.json();
    check("POST /users com JSON válido -> 201", res.status === 201, String(res.status));
    check("POST /users com JSON válido -> ecoa o campo", body.name === "Ana", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/users/10`, { method: "PUT" });
    const body = await res.json();
    check("PUT /users/:id -> 200", res.status === 200, String(res.status));
    check("PUT /users/:id -> corpo correto", body === "user updated", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/users/10`, { method: "PATCH" });
    const body = await res.json();
    check("PATCH /users/:id -> 200", res.status === 200, String(res.status));
    check("PATCH /users/:id -> corpo correto", body === "user patched", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/users/10`, { method: "DELETE" });
    const body = await res.json();
    check("DELETE /users/:id -> 200", res.status === 200, String(res.status));
    check("DELETE /users/:id -> corpo correto", body === "user deleted", JSON.stringify(body));
  }

  {
    // /users só tem POST registrado. GET /users deve retornar 405 com Allow: POST, OPTIONS
    const res = await fetch(`${base}/users`, { method: "GET" });
    const body = await res.json();
    const allow = res.headers.get("allow") ?? "";
    check("GET em rota apenas POST -> 405", res.status === 405, String(res.status));
    check("GET em rota apenas POST -> corpo 'method not allowed'", body.error === "method not allowed", JSON.stringify(body));
    check("GET em rota apenas POST -> header Allow contém POST", allow.includes("POST"), allow);
  }

  {
    // OPTIONS em /users/:id deve retornar 204 com Allow
    const res = await fetch(`${base}/users/10`, { method: "OPTIONS" });
    const allow = res.headers.get("allow") ?? "";
    check("OPTIONS /users/:id -> 204", res.status === 204, String(res.status));
    check(
      "OPTIONS /users/:id -> header Allow contém GET, PUT, PATCH, DELETE",
      allow.includes("GET") && allow.includes("PUT") && allow.includes("PATCH") && allow.includes("DELETE"),
      allow,
    );
  }

  {
    // HEAD em /users/42 deve retornar 200 sem corpo
    const res = await fetch(`${base}/users/42`, { method: "HEAD" });
    const text = await res.text();
    check("HEAD /users/:id -> 200", res.status === 200, String(res.status));
    check("HEAD /users/:id -> sem corpo", text === "", text);
  }

  {
    const res = await fetch(`${base}/users`, { method: "POST", body: "{not json" });
    const body = await res.json();
    check("POST /users com JSON malformado -> 400", res.status === 400, String(res.status));
    check("POST /users com JSON malformado -> corpo tem 'error'", typeof body.error === "string", JSON.stringify(body));
  }

  {
    // ServerConfig.max_body_size da fixture é 64 bytes — bem menor que este corpo.
    const res = await fetch(`${base}/users`, { method: "POST", body: JSON.stringify({ name: "x".repeat(200) }) });
    check("POST /users com corpo > max_body_size -> 413", res.status === 413, String(res.status));
  }

  {
    const res = await fetch(`${base}/healthz`);
    const body = await res.json();
    check("GET /healthz padrão -> 200", res.status === 200, String(res.status));
    check("GET /healthz padrão -> corpo {status: ok}", body.status === "ok", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/panic`);
    const body = await res.json();
    check("GET /panic -> 500 (RFC-008/009 panic recovery)", res.status === 500, String(res.status));
    check("GET /panic -> erro genérico sem leak de stack trace", body.error === "internal server error", JSON.stringify(body));
  }

  {
    const res = await fetch(`${base}/nope`);
    check("GET rota inexistente -> 404", res.status === 404, String(res.status));
  }
}

function fixtureFor(port: number): string {
  const template = fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "http_v1_server.flex"), "utf-8");
  return template.replaceAll("__PORT__", String(port));
}

async function runInterpreted(port: number): Promise<void> {
  console.log("\n== Modo interpretado ==");
  const ast = new Parser(new Lexer(fixtureFor(port)).tokenize()).parse();
  new TypeChecker().check(ast);

  const interpreter = new Interpreter(() => {}); // silencia print() da fixture
  // `server.start()` nunca resolve (mantém o processo vivo escutando) — de
  // propósito não aguardamos aqui, senão o teste travaria para sempre.
  void interpreter.run(ast).catch((e) => {
    console.error(red("[ERRO] interpretador falhou:"), e);
  });

  await waitForServer(`http://localhost:${port}/users/1`);
  await runScenarios(`http://localhost:${port}`);
}

async function runCompiled(port: number, goBin: string): Promise<void> {
  console.log("\n== Modo compilado ==");
  const ast = new Parser(new Lexer(fixtureFor(port)).tokenize()).parse();
  const types = new TypeChecker().check(ast);
  const goCode = new GoTranspiler().transpile(ast, types);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-http-"));
  const goPath = path.join(workDir, "server.go");
  const binPath = path.join(workDir, "server");
  fs.writeFileSync(goPath, goCode, "utf-8");

  try {
    execFileSync(goBin, ["build", "-o", binPath, goPath], { stdio: "pipe" });
  } catch (e: any) {
    console.log(red("[FAIL] 'go build' falhou:"));
    console.log(String(e.stderr ?? e.message).trim());
    console.log(dim(`  Go gerado: ${goPath}`));
    failed++;
    return;
  }

  let child: ChildProcess | undefined;
  try {
    child = spawn(binPath, [], { stdio: "ignore" });
    await waitForServer(`http://localhost:${port}/users/1`);
    await runScenarios(`http://localhost:${port}`);
  } finally {
    child?.kill();
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  await runInterpreted(18080);

  const goBin = findGo();
  if (!goBin) {
    console.log(red("\n[ERRO] Go não encontrado — modo compilado pulado."));
  } else {
    await runCompiled(18081, goBin);
  }

  console.log(`\nHTTP integration: ${passed} passaram, ${failed} falharam.\n`);
  // O servidor interpretado continua escutando (a promise de start() nunca
  // resolve) — sem isso o processo nunca terminaria sozinho.
  process.exit(failed > 0 ? 1 : 0);
}

main();
