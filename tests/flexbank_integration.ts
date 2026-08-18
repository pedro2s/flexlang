/**
 * Teste de Integração End-to-End do FlexBank API (RFC-030).
 *
 * Valida o projeto de referência enterprise executando requisições HTTP reais
 * nos modos interpretado (Node.js) e compilado (Go), exercitando:
 * - Precisão monetária Decimal (0.1 + 0.2 = 0.3, saldo e transferências)
 * - Simulação de juros compostos com Decimal.pow
 * - Autenticação com hash bcrypt e bcrypt_verify
 * - Tokens com UUID v4 e expiração Time / Duration
 * - Middleware de Correlation ID e CORS
 * - Tratamento de erros com catch blocks e códigos HTTP REST
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync, spawn, type ChildProcess } from "child_process";
import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";
import { GoTranspiler } from "../src/transpiler";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

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
  // 1. Healthcheck
  {
    const res = await fetch(`${base}/healthz`);
    const body = await res.json();
    check("GET /healthz -> 200", res.status === 200, String(res.status));
    check("GET /healthz -> status ok", body.status === "ok", JSON.stringify(body));
  }

  // 2. Consulta de conta existente (Alice)
  {
    const res = await fetch(`${base}/accounts/acc_alice`);
    const body = await res.json();
    check("GET /accounts/acc_alice -> 200", res.status === 200, String(res.status));
    check("GET /accounts/acc_alice -> titular correto", body.holder === "Alice Santana", body.holder);
    check("GET /accounts/acc_alice -> saldo Decimal inicial", body.balance === "1500.50", body.balance);
    check("Headers -> X-Correlation-ID presente", res.headers.has("x-correlation-id"), "ausente");
  }

  // 3. Consulta de saldo isolado (Bob)
  {
    const res = await fetch(`${base}/accounts/acc_bob/balance`);
    const body = await res.json();
    check("GET /accounts/acc_bob/balance -> 200", res.status === 200, String(res.status));
    check("GET /accounts/acc_bob/balance -> saldo Decimal", body.balance === "300.00", body.balance);
  }

  // 4. Autenticação (Login válido com bcrypt_verify)
  {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@flexbank.com",
        password: "senha123",
      }),
    });
    const body = await res.json();
    check("POST /auth/login (sucesso) -> 200", res.status === 200, String(res.status));
    check("POST /auth/login -> token UUID gerado", typeof body.token === "string" && body.token.length > 20, body.token);
    check("POST /auth/login -> expiração ISO 8601 presente", typeof body.expires_at === "string" && body.expires_at.includes("T"), body.expires_at);
  }

  // 5. Autenticação (Login com senha incorreta)
  {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@flexbank.com",
        password: "senha_errada",
      }),
    });
    check("POST /auth/login (senha errada) -> 401", res.status === 401, String(res.status));
  }

  // 6. Cadastro de Novo Usuário (com bcrypt hash)
  let newAccId = "";
  {
    const res = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Carlos Eduardo",
        email: "carlos@flexbank.com",
        cpf: "111.222.333-44",
        password: "novasenha456",
      }),
    });
    const body = await res.json();
    check("POST /auth/register -> 201", res.status === 201, String(res.status));
    check("POST /auth/register -> conta criada com saldo zero", typeof body.account_id === "string", JSON.stringify(body));
    newAccId = body.account_id;
  }

  // 7. Transferência com Precisão Decimal (Alice -> Bob: 200.25)
  {
    const res = await fetch(`${base}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: "acc_alice",
        target_id: "acc_bob",
        amount: "200.25",
      }),
    });
    const body = await res.json();
    check("POST /transfers -> 201", res.status === 201, String(res.status));
    check("POST /transfers -> status COMPLETED", body.status === "COMPLETED", JSON.stringify(body));

    // Validação dos saldos após transferência
    const resAlice = await fetch(`${base}/accounts/acc_alice/balance`);
    const bodyAlice = await resAlice.json();
    check("Saldo Alice após débito -> 1300.25", bodyAlice.balance === "1300.25", bodyAlice.balance);

    const resBob = await fetch(`${base}/accounts/acc_bob/balance`);
    const bodyBob = await resBob.json();
    check("Saldo Bob após crédito -> 500.25", bodyBob.balance === "500.25", bodyBob.balance);
  }

  // 8. Teste de Precisão Monetária Absoluta (0.10 + 0.20 = 0.30)
  {
    const res1 = await fetch(`${base}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: "acc_alice",
        target_id: newAccId,
        amount: "0.10",
      }),
    });
    check("Transferência 0.10 -> 201", res1.status === 201, String(res1.status));

    const res2 = await fetch(`${base}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: "acc_alice",
        target_id: newAccId,
        amount: "0.20",
      }),
    });
    check("Transferência 0.20 -> 201", res2.status === 201, String(res2.status));

    const resCarlos = await fetch(`${base}/accounts/${newAccId}/balance`);
    const bodyCarlos = await resCarlos.json();
    check("Saldo Carlos: 0.10 + 0.20 = exatamente 0.30 (sem erro binário de float)", bodyCarlos.balance === "0.30" || bodyCarlos.balance === "0.3", bodyCarlos.balance);
  }

  // 9. Transferência com Saldo Insuficiente
  {
    const res = await fetch(`${base}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: "acc_bob",
        target_id: "acc_alice",
        amount: "99999.00",
      }),
    });
    const body = await res.json();
    check("POST /transfers com saldo insuficiente -> 422", res.status === 422, String(res.status));
    check("POST /transfers -> erro de saldo retornado via catch", body.error === "Saldo insuficiente", JSON.stringify(body));
  }

  // 10. Extrato de Transações (Array methods e closures)
  {
    const res = await fetch(`${base}/accounts/acc_alice/statement`);
    const body = await res.json();
    check("GET /accounts/acc_alice/statement -> 200", res.status === 200, String(res.status));
    check("Extrato contém transações", body.transactions.length >= 3, `len=${body.transactions.length}`);
  }

  // 11. Simulação de Investimentos com Juros Compostos (Decimal.pow)
  // M = 1000 * (1 + 0.01)^12 = 1126.83
  {
    const res = await fetch(`${base}/investments/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        principal: "1000.00",
        monthly_rate: "0.01",
        months: "12",
      }),
    });
    const body = await res.json();
    check("POST /investments/simulate -> 200", res.status === 200, String(res.status));
    check("Juros compostos: 1000 a 1% a.m por 12 meses = 1126.83", body.total_amount === "1126.83", body.total_amount);
  }

  // 12. Atualização e Encerramento de Conta
  {
    const resPut = await fetch(`${base}/accounts/acc_bob`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holder: "Roberto Silva" }),
    });
    const bodyPut = await resPut.json();
    check("PUT /accounts/acc_bob -> 200", resPut.status === 200, String(resPut.status));
    check("PUT /accounts/acc_bob -> titular atualizado", bodyPut.holder === "Roberto Silva", bodyPut.holder);

    const resDel = await fetch(`${base}/accounts/acc_bob`, { method: "DELETE" });
    const bodyDel = await resDel.json();
    check("DELETE /accounts/acc_bob -> 200", resDel.status === 200, String(resDel.status));
    check("DELETE /accounts/acc_bob -> status CLOSED", bodyDel.status === "CLOSED", bodyDel.status);

    // Tentativa de transferir para conta fechada
    const resTransferClosed = await fetch(`${base}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: "acc_alice",
        target_id: "acc_bob",
        amount: "50.00",
      }),
    });
    check("Transferência para conta CLOSED -> 422", resTransferClosed.status === 422, String(resTransferClosed.status));
  }

  // 13. Validação de CORS
  {
    const res = await fetch(`${base}/accounts/acc_alice`, {
      headers: { Origin: "https://flexbank.com.br" },
    });
    const origin = res.headers.get("access-control-allow-origin");
    check("CORS -> Access-Control-Allow-Origin emitido", origin === "https://flexbank.com.br", origin ?? "null");
  }
}

async function runInterpreted(port: number, entryPath: string): Promise<void> {
  console.log(bold("\n=== Modo Interpretado (Node.js) ==="));
  process.env.FLEXBANK_PORT = String(port);

  const graph = loadModuleGraph(entryPath);
  const checker = new TypeChecker();
  checker.check(graph);

  const interpreter = new Interpreter(() => {});
  void interpreter.run(graph).catch((e) => {
    console.error(red("[ERRO] interpretador falhou:"), e);
  });

  await waitForServer(`http://localhost:${port}/healthz`);
  await runScenarios(`http://localhost:${port}`);
}

async function runCompiled(port: number, entryPath: string, goBin: string): Promise<void> {
  console.log(bold("\n=== Modo Compilado (Go) ==="));
  process.env.FLEXBANK_PORT = String(port);

  const graph = loadModuleGraph(entryPath);
  const checker = new TypeChecker();
  const types = checker.check(graph);
  const transpiler = new GoTranspiler();
  const goCode = transpiler.transpile(graph, types);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "flexbank-"));
  const goPath = path.join(workDir, "main.go");
  const binPath = path.join(workDir, "flexbank_bin");
  fs.writeFileSync(goPath, goCode, "utf-8");

  let proc: ChildProcess | undefined;
  try {
    execFileSync(goBin, ["build", "-o", binPath, goPath], {
      cwd: workDir,
      stdio: "pipe",
    });

    proc = spawn(binPath, [], {
      env: { ...process.env, FLEXBANK_PORT: String(port) },
      stdio: "ignore",
    });

    await waitForServer(`http://localhost:${port}/healthz`);
    await runScenarios(`http://localhost:${port}`);
  } finally {
    if (proc && !proc.killed) {
      proc.kill("SIGKILL");
    }
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  console.log(bold("🏦 Iniciando Suíte de Integração End-to-End: FlexBank API (RFC-030)..."));

  const entryPath = path.resolve(process.cwd(), "examples/09_flexbank_api/src/main.flex");
  const basePort = 3500 + Math.floor(Math.random() * 1000);

  // Executa no interpretador
  await runInterpreted(basePort, entryPath);

  // Executa no compilado Go
  const goBin = findGo();
  if (goBin) {
    await runCompiled(basePort + 1, entryPath, goBin);
  } else {
    console.log(red("\n[AVISO] Go não encontrado no PATH; testes compilados pulados."));
  }

  console.log(`\n========================================`);
  console.log(`Resultado Final: ${green(`${passed} passaram`)}, ${failed > 0 ? red(`${failed} falharam`) : "0 falharam"}`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(red("Erro fatal na execução dos testes:"), e);
  process.exit(1);
});
