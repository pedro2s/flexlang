import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";
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

async function main() {
  console.log("\n== Teste de Integração: Framework Nativo de Testes Unitários (RFC-041) ==");

  // Cenário 1: Asserções que passam com sucesso
  {
    const code = `
      import { testing } from "std/testing";

      testing.assert_true(10 > 5, "dez maior que cinco");
      testing.assert_false(5 > 10, "cinco nao maior que dez");
      testing.assert_eq("flex", "flex", "strings iguais");
      testing.assert_neq("flex", "rust", "strings diferentes");

      let ok_res = Result.Ok(42);
      let unwrapped_ok = testing.assert_ok(ok_res, "ok deve desempacotar");
      testing.assert_eq(unwrapped_ok, 42, "unwrapped deve ser 42");

      let err_res = Result.Err("erro 500");
      let unwrapped_err = testing.assert_err(err_res, "err deve desempacotar");
      testing.assert_eq(unwrapped_err, "erro 500", "unwrapped deve ser erro 500");

      let opt_some = Option.Some("usuario");
      let unwrapped_some = testing.assert_some(opt_some, "some deve desempacotar");
      testing.assert_eq(unwrapped_some, "usuario", "unwrapped deve ser usuario");

      testing.assert_none(Option.None, "deve ser none");
      print("all_assertions_passed");
    `;

    const out = await runFlex(code);
    check("Todas as asserções de sucesso executam sem exceção", out.includes("all_assertions_passed"), out);
  }

  // Cenário 2: Asserções que falham capturadas controladamente
  {
    const code = `
      import { testing } from "std/testing";

      testing.assert_eq(10, 20, "dez nao e vinte");
    `;

    let failedAsExpected = false;
    try {
      await runFlex(code);
    } catch (e: any) {
      if (e.message.includes("dez nao e vinte") && e.message.includes("assertion failed")) {
        failedAsExpected = true;
      }
    }
    check("assert_eq falha com mensagem descritiva quando valores diferem", failedAsExpected);
  }

  // Cenário 3: assert_ok falha quando recebe Result.Err
  {
    const code = `
      import { testing } from "std/testing";

      let bad = Result.Err("database connection refused");
      testing.assert_ok(bad, "deve falhar");
    `;

    let failedAsExpected = false;
    try {
      await runFlex(code);
    } catch (e: any) {
      if (e.message.includes("expected Result.Ok, got Result.Err('database connection refused')")) {
        failedAsExpected = true;
      }
    }
    check("assert_ok falha graciosamente em Result.Err", failedAsExpected);
  }

  // Cenário 4: assert_some falha quando recebe Option.None
  {
    const code = `
      import { testing } from "std/testing";

      testing.assert_some(Option.None, "chave ausente");
    `;

    let failedAsExpected = false;
    try {
      await runFlex(code);
    } catch (e: any) {
      if (e.message.includes("expected Option.Some, got Option.None")) {
        failedAsExpected = true;
      }
    }
    check("assert_some falha graciosamente em Option.None", failedAsExpected);
  }

  // Cenário 5: Execução do CLI `flex test` em arquivo com funções #[test]
  {
    const tmpTestFile = path.join(process.cwd(), "tests", "math_sample_test.flex");
    const testCode = `
import { testing } from "std/testing";

#[test]
func test_addition() {
    testing.assert_eq(2 + 2, 4, "soma simples");
}

#[test]
func test_multiplication() {
    testing.assert_eq(3 * 3, 9, "multiplicacao simples");
}
`;
    fs.writeFileSync(tmpTestFile, testCode, "utf-8");

    try {
      // 1. Teste no modo interpretado via CLI
      const cliOutInterpreted = execSync(`npx tsx src/cli.ts test tests/math_sample_test.flex`, { encoding: "utf-8" });
      check("CLI flex test (interpretado) executa funções #[test]", cliOutInterpreted.includes("test test_addition ... \x1b[32mok\x1b[0m") && cliOutInterpreted.includes("test test_multiplication ... \x1b[32mok\x1b[0m"), cliOutInterpreted);
      check("CLI flex test (interpretado) exibe resumo de sucesso", cliOutInterpreted.includes("test result: \x1b[32mok\x1b[0m. 2 passed; 0 failed"), cliOutInterpreted);

      // 2. Teste no modo nativo Go via CLI (--native)
      const cliOutNative = execSync(`npx tsx src/cli.ts test --native tests/math_sample_test.flex`, { encoding: "utf-8" });
      check("CLI flex test --native (Go) executa funções #[test]", cliOutNative.includes("test test_addition ... \x1b[32mok\x1b[0m") && cliOutNative.includes("test test_multiplication ... \x1b[32mok\x1b[0m"), cliOutNative);
      check("CLI flex test --native (Go) exibe resumo nativo", cliOutNative.includes("test result: \x1b[32mok\x1b[0m. 2 passed; 0 failed"), cliOutNative);
    } finally {
      if (fs.existsSync(tmpTestFile)) {
        fs.unlinkSync(tmpTestFile);
      }
    }
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro no teste de integração Testing Framework:", err);
  process.exit(1);
});
