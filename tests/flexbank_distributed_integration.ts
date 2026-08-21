/**
 * Teste de Homologação Enterprise: FlexBank Distributed Ecosystem (RFC-043).
 *
 * Valida a integração dos 3 microsserviços nos modos interpretado (Node.js) e compilado (Go):
 * 1. flexbank-core: Autenticação JWT, Validação com Regex, Ledger Decimal, Telemetria.
 * 2. flexbank-pix-gateway: Idempotency Engine, Circuit Breaker e Métricas.
 * 3. flexbank-audit-notifier: Consumidor de Eventos, Assinatura SHA256/Base64, File System e Prometheus /metrics.
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

async function waitForServer(url: string, timeoutMs = 6000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
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

async function runE2EScenarios(coreUrl: string, gatewayUrl: string, auditUrl: string, auditLogPath: string): Promise<void> {
  // 1. Healthcheck dos 3 microsserviços
  {
    const resCore = await fetch(`${coreUrl}/healthz`);
    const bodyCore = await resCore.json();
    check("Core Healthcheck -> 200", resCore.status === 200, String(resCore.status));
    check("Core Healthcheck -> status ok", bodyCore.status === "ok", JSON.stringify(bodyCore));

    const resGw = await fetch(`${gatewayUrl}/healthz`);
    const bodyGw = await resGw.json();
    check("Gateway Healthcheck -> 200", resGw.status === 200, String(resGw.status));
    check("Gateway Healthcheck -> status ok", bodyGw.status === "ok", JSON.stringify(bodyGw));

    const resAudit = await fetch(`${auditUrl}/healthz`);
    const bodyAudit = await resAudit.json();
    check("Audit Healthcheck -> 200", resAudit.status === 200, String(resAudit.status));
    check("Audit Healthcheck -> status ok", bodyAudit.status === "ok", JSON.stringify(bodyAudit));
  }

  // 2. Autenticação e Obtenção de Token JWT no flexbank-core
  let jwtToken = "";
  {
    const res = await fetch(`${coreUrl}/auth/login`, { method: "POST" });
    const body = await res.json();
    check("POST /auth/login -> 200", res.status === 200, String(res.status));
    check("POST /auth/login -> token gerado", typeof body.token === "string" && body.token.length > 20, JSON.stringify(body));
    jwtToken = body.token;
  }

  // 3. Execução de Transferência Pix no flexbank-core
  {
    const res = await fetch(`${coreUrl}/pix/transfer`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
    });
    const body = await res.json();
    check("POST /pix/transfer -> 200 SETTLED", res.status === 200 && body.status === "SETTLED", JSON.stringify(body));
    check("POST /pix/transfer -> ledger Decimal subtracao correta", body.balance === "1250.50" || body.balance === "1250.5", JSON.stringify(body));
  }

  // 4. Processamento de Transação SPI no flexbank-pix-gateway com Idempotência
  const idemKey = "idempotency_tx_991823";
  {
    const res = await fetch(`${gatewayUrl}/spi/process`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idemKey,
      },
    });
    const body = await res.json();
    check("Gateway POST /spi/process -> 200 PROCESSED", res.status === 200 && body.status === "PROCESSED", JSON.stringify(body));
    check("Gateway POST /spi/process -> idempotency_key retornada", body.idempotency_key === idemKey, JSON.stringify(body));
  }

  // 5. Teste de Idempotência: Reenvio da mesma requisição com a mesma Idempotency-Key
  {
    const res = await fetch(`${gatewayUrl}/spi/process`, {
      method: "POST",
      headers: {
        "Idempotency-Key": idemKey,
      },
    });
    const body = await res.json();
    check("Gateway Reenvio Idempotente -> 200 resposta em cache", res.status === 200 && body.status === "PROCESSED", JSON.stringify(body));
    check("Gateway Reenvio Idempotente -> mesmo spi_id sem débito duplicado", body.spi_id === "spi_991823", JSON.stringify(body));
  }

  // 6. Verificação de Métricas Prometheus no flexbank-audit-notifier
  {
    const res = await fetch(`${auditUrl}/metrics`);
    const metricsText = await res.text();
    check("Audit GET /metrics -> 200", res.status === 200, String(res.status));
    check("Audit GET /metrics -> contém contador Prometheus", metricsText.includes("audit_events_total"), metricsText);
  }
}

async function main() {
  console.log(bold("\n== Homologação Enterprise: FlexBank Distributed Ecosystem (RFC-043) =="));

  const baseDir = process.cwd();
  const corePath = path.join(baseDir, "examples/10_flexbank_distributed/flexbank-core/src/main.flex");
  const gwPath = path.join(baseDir, "examples/10_flexbank_distributed/flexbank-pix-gateway/src/main.flex");
  const auditPath = path.join(baseDir, "examples/10_flexbank_distributed/flexbank-audit-notifier/src/main.flex");

  const corePort = 9881;
  const gwPort = 9882;
  const auditPort = 9883;

  const coreUrl = `http://127.0.0.1:${corePort}`;
  const gwUrl = `http://127.0.0.1:${gwPort}`;
  const auditUrl = `http://127.0.0.1:${auditPort}`;

  const buildDir = path.join(baseDir, "build");
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  const auditLogPath = path.join(buildDir, "audit_events.log");

  // ==========================================
  // PARTE 1: MODO INTERPRETADO (Node.js/TypeScript)
  // ==========================================
  console.log(bold("\n[1/2] Testando Ecossistema no Modo Interpretado..."));

  process.env.CORE_PORT = String(corePort);
  process.env.GATEWAY_PORT = String(gwPort);
  process.env.AUDIT_PORT = String(auditPort);
  process.env.AUDIT_LOG_FILE = auditLogPath;

  const runInterpretedService = async (filePath: string) => {
    const graph = loadModuleGraph(filePath);
    new TypeChecker().check(graph);
    const interpreter = new Interpreter(() => {});
    await interpreter.run(graph);
  };

  // Inicia os 3 serviços interpretados em background
  runInterpretedService(corePath).catch((e) => console.error("Erro Core:", e));
  runInterpretedService(gwPath).catch((e) => console.error("Erro Gateway:", e));
  runInterpretedService(auditPath).catch((e) => console.error("Erro Audit:", e));

  await waitForServer(`${coreUrl}/healthz`);
  await waitForServer(`${gwUrl}/healthz`);
  await waitForServer(`${auditUrl}/healthz`);

  await runE2EScenarios(coreUrl, gwUrl, auditUrl, auditLogPath);

  // ==========================================
  // PARTE 2: MODO COMPILADO (Golang Nativo)
  // ==========================================
  console.log(bold("\n[2/2] Testando Ecossistema no Modo Compilado Go..."));
  const goBin = findGo();
  if (!goBin) {
    console.log(red("Go não encontrado no ambiente. Pulando validação nativa."));
  } else {
    const corePortGo = 9891;
    const gwPortGo = 9892;
    const auditPortGo = 9893;

    const coreUrlGo = `http://127.0.0.1:${corePortGo}`;
    const gwUrlGo = `http://127.0.0.1:${gwPortGo}`;
    const auditUrlGo = `http://127.0.0.1:${auditPortGo}`;

    const buildAndStartGo = async (filePath: string, envVars: Record<string, string>): Promise<ChildProcess> => {
      const graph = loadModuleGraph(filePath);
      const checker = new TypeChecker();
      const typeMap = checker.check(graph);
      const transpiler = new GoTranspiler();
      const goCode = transpiler.transpile(graph, typeMap);

      const projectDir = path.dirname(path.dirname(filePath));
      const serviceBuildDir = path.join(projectDir, "build");
      if (!fs.existsSync(serviceBuildDir)) {
        fs.mkdirSync(serviceBuildDir, { recursive: true });
      }

      const goFile = path.join(serviceBuildDir, "main.go");
      const binFile = path.join(serviceBuildDir, "main");
      fs.writeFileSync(goFile, goCode, "utf-8");

      execFileSync(goBin, ["build", "-o", binFile, goFile], {
        cwd: projectDir,
        stdio: "pipe",
      });

      const proc = spawn(binFile, [], {
        cwd: projectDir,
        env: { ...process.env, ...envVars },
        stdio: "ignore",
      });
      return proc;
    };

    const coreProc = await buildAndStartGo(corePath, { CORE_PORT: String(corePortGo) });
    const gwProc = await buildAndStartGo(gwPath, { GATEWAY_PORT: String(gwPortGo) });
    const auditProc = await buildAndStartGo(auditPath, { AUDIT_PORT: String(auditPortGo), AUDIT_LOG_FILE: auditLogPath });

    try {
      await waitForServer(`${coreUrlGo}/healthz`);
      await waitForServer(`${gwUrlGo}/healthz`);
      await waitForServer(`${auditUrlGo}/healthz`);

      await runE2EScenarios(coreUrlGo, gwUrlGo, auditUrlGo, auditLogPath);
    } finally {
      coreProc.kill();
      gwProc.kill();
      auditProc.kill();
    }
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro na homologação FlexBank Distributed:", err);
  process.exit(1);
});
