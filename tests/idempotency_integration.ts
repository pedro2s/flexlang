import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";
import { GoTranspiler } from "../src/transpiler";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

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

async function runFlex(code: string): Promise<string> {
  const ast = new Parser(new Lexer(code).tokenize()).parse();
  new TypeChecker().check(ast);

  let output = "";
  const interpreter = new Interpreter((msg) => {
    output += msg + "\n";
  });
  await interpreter.run(ast);
  return output;
}

function runNative(code: string): string {
  const ast = new Parser(new Lexer(code).tokenize()).parse();
  const checker = new TypeChecker();
  const types = checker.check(ast);
  const transpiler = new GoTranspiler();
  const goCode = transpiler.transpile(ast, types);

  const buildDir = path.join(process.cwd(), "build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const goFile = path.join(buildDir, "temp_idempotency_runner.go");
  const binFile = path.join(buildDir, "temp_idempotency_bin");
  fs.writeFileSync(goFile, goCode, "utf-8");

  try {
    execSync(`go build -o ${binFile} ${goFile}`, { stdio: "pipe" });
    const stdout = execSync(`${binFile}`, { encoding: "utf-8" });
    return stdout;
  } finally {
    if (fs.existsSync(goFile)) fs.unlinkSync(goFile);
    if (fs.existsSync(binFile)) fs.unlinkSync(binFile);
  }
}

async function main() {
  console.log("\n== Teste de Integração: Motor de Idempotência Financeira (RFC-042) ==");

  // Cenário 1: Ciclo completo de idempotência com replay de resposta cacheada
  {
    const code = `
      import { IdempotencyEngine, IdempotencyConfig } from "finance/idempotency";
      import { Duration } from "core/time";

      func run() -> Result<Bool, String> {
          let engine = IdempotencyEngine.new(IdempotencyConfig {
              ttl: Duration.hours(12),
              header_name: "Idempotency-Key",
              lock_timeout: Duration.seconds(10)
          })?;

          let key = "pix_transf_98765";

          // 1. Chave inédita
          let c1 = engine.check(key)?;
          match c1 {
              Option.None { print("status_c1_none"); },
              Option.Some(s) { print("error_c1"); }
          }

          // 2. Lock
          let lock = engine.start_processing(key)?;
          print("lock_acquired");

          // 3. Salva conclusão
          engine.save_completed(key, 201, "{\\\"pix_id\\\":\\\"px_111\\\",\\\"amount\\\":500}")?;
          print("saved_completed");

          // 4. Replay
          let c2 = engine.check(key)?;
          match c2 {
              Option.Some(cached) {
                  print("replay_status_" + cached.status.to_string());
                  print(cached.body);
              },
              Option.None { print("error_c2"); }
          }
          return Result.Ok(true);
      }

      run();
    `;

    const outInterpreted = await runFlex(code);
    check("Ciclo completo executa no modo interpretado", outInterpreted.includes("status_c1_none") && outInterpreted.includes("replay_status_201"), outInterpreted);

    const outNative = runNative(code);
    check("Ciclo completo executa no modo compilado Go com paridade", outNative === outInterpreted, `\nInterpreted:\n${outInterpreted}\nNative:\n${outNative}`);
  }

  // Cenário 2: Liberação de lock com lock.release() em caso de cancelamento/erro
  {
    const code = `
      import { IdempotencyEngine, IdempotencyConfig } from "finance/idempotency";
      import { Duration } from "core/time";

      func run() -> Result<Bool, String> {
          let engine = IdempotencyEngine.new(IdempotencyConfig {
              ttl: Duration.hours(1),
              header_name: "Idempotency-Key"
          })?;

          let key = "failed_tx_001";
          let lock = engine.start_processing(key)?;
          
          // Libera lock sem salvar completed (simula rollback)
          lock.release()?;

          // Chave volta a ficar livre
          let c = engine.check(key)?;
          match c {
              Option.None { print("lock_released_ok"); },
              Option.Some(s) { print("error_lock_not_released"); }
          }
          return Result.Ok(true);
      }

      run();
    `;

    const out = await runFlex(code);
    check("lock.release() remove o estado de processamento liberando a chave", out.includes("lock_released_ok"), out);
  }

  // Cenário 3: Bloqueio de chave já em processamento
  {
    const code = `
      import { IdempotencyEngine, IdempotencyConfig } from "finance/idempotency";
      import { Duration } from "core/time";

      func run() -> Result<Bool, String> {
          let engine = IdempotencyEngine.new(IdempotencyConfig {
              ttl: Duration.hours(1),
              header_name: "Idempotency-Key"
          })?;

          let key = "concurrent_key_777";
          let lock1 = engine.start_processing(key)?;

          let lock2_res = engine.start_processing(key);
          match lock2_res {
              Result.Ok(l) { print("error_concurrent_lock_succeeded"); },
              Result.Err(err) {
                  print("concurrent_lock_blocked");
              }
          }
          return Result.Ok(true);
      }

      run();
    `;

    const out = await runFlex(code);
    check("start_processing bloqueia tentativas de lock concorrente para a mesma chave", out.includes("concurrent_lock_blocked"), out);
  }

  // Cenário 4: Limpeza explícita com clear()
  {
    const code = `
      import { IdempotencyEngine, IdempotencyConfig } from "finance/idempotency";
      import { Duration } from "core/time";

      func run() -> Result<Bool, String> {
          let engine = IdempotencyEngine.new(IdempotencyConfig {
              ttl: Duration.hours(1),
              header_name: "Idempotency-Key"
          })?;

          let key = "clear_key_888";
          engine.save_completed(key, 200, "{\\\"ok\\\":true}")?;
          engine.clear(key)?;

          let c = engine.check(key)?;
          match c {
              Option.None { print("cleared_successfully"); },
              Option.Some(s) { print("error_not_cleared"); }
          }
          return Result.Ok(true);
      }

      run();
    `;

    const out = await runFlex(code);
    check("clear() expurga a chave do armazenamento de idempotência", out.includes("cleared_successfully"), out);
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro no teste de integração Idempotency Engine:", err);
  process.exit(1);
});
