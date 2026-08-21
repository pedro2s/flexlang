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

  const goFile = path.join(buildDir, "temp_scheduler_runner.go");
  const binFile = path.join(buildDir, "temp_scheduler_bin");
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
  console.log("\n== Teste de Integração: Agendador de Tarefas em Background (RFC-045) ==");

  // Cenário 1: Ciclo completo de agendamento e execução determinística
  {
    const code = `
      import { scheduler, CronJob } from "core/scheduler";

      let mut balance_closed = false;
      let mut spi_cleared = false;

      let j1 = scheduler.cron("0 0 * * *", || {
          balance_closed = true;
      });

      let j2 = scheduler.every("30s", || {
          spi_cleared = true;
      });

      print("jobs_count_\${scheduler.jobs_count()}");

      scheduler.run_pending();

      print("balance_closed_\${balance_closed}");
      print("spi_cleared_\${spi_cleared}");

      scheduler.stop_all();
    `;

    const outInterpreted = await runFlex(code);
    check("Ciclo de agendamento executa no modo interpretado", outInterpreted.includes("jobs_count_2") && outInterpreted.includes("balance_closed_true") && outInterpreted.includes("spi_cleared_true"), outInterpreted);

    const outNative = runNative(code);
    check("Ciclo de agendamento executa no modo compilado Go com paridade", outNative === outInterpreted, `\nInterpreted:\n${outInterpreted}\nNative:\n${outNative}`);
  }

  // Cenário 2: One-shot execution com after e trigger individual
  {
    const code = `
      import { scheduler, CronJob } from "core/scheduler";

      let mut notification_sent = false;

      let j = scheduler.after("2h", || {
          notification_sent = true;
      });

      print("job_type_\${j.job_type}");
      print("notification_before_\${notification_sent}");

      j.trigger();

      print("notification_after_\${notification_sent}");
      j.stop();
    `;

    const out = await runFlex(code);
    check("trigger() manual dispara tarefas one-shot sob demanda", out.includes("job_type_after") && out.includes("notification_before_false") && out.includes("notification_after_true"), out);
  }

  // Cenário 3: Interrupção de jobs com stop()
  {
    const code = `
      import { scheduler, CronJob } from "core/scheduler";

      let j = scheduler.every("10s", || {
          print("tick");
      });

      j.stop();
      scheduler.stop_all();
      print("all_stopped_ok");
    `;

    const out = await runFlex(code);
    check("stop() e stop_all() encerram agendamentos sem travar", out.includes("all_stopped_ok"), out);
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro no teste de integração Scheduler:", err);
  process.exit(1);
});
