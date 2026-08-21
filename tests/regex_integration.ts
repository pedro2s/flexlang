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

  const goFile = path.join(buildDir, "temp_regex_runner.go");
  const binFile = path.join(buildDir, "temp_regex_bin");
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
  console.log("\n== Teste de Integração: Expressões Regulares Nativas (RFC-044) ==");

  // Cenário 1: Validação de Formatos Financeiros (Pix keys, CPF, UUIDs)
  {
    const code = `
      import { regex, Regex } from "std/regex";

      func test_validation() -> Result<Bool, String> {
          let email_re = regex.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")?;
          let is_valid_email = email_re.matches("pix.financeiro@flexlang.dev");
          let is_invalid_email = email_re.matches("pix@invalido");
          print("email_valid_\${is_valid_email}");
          print("email_invalid_\${is_invalid_email}");

          let uuid_re = regex.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")?;
          let is_uuid = uuid_re.matches("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
          print("uuid_valid_\${is_uuid}");

          return Result.Ok(true);
      }

      test_validation();
    `;

    const outInterpreted = await runFlex(code);
    check("Validações de email e UUID no modo interpretado", outInterpreted.includes("email_valid_true") && outInterpreted.includes("email_invalid_false") && outInterpreted.includes("uuid_valid_true"), outInterpreted);

    const outNative = runNative(code);
    check("Validações executam no modo compilado Go com paridade idêntica", outNative === outInterpreted, `\nInterpreted:\n${outInterpreted}\nNative:\n${outNative}`);
  }

  // Cenário 2: find_all e iteração sobre múltiplos matches em logs
  {
    const code = `
      import { regex, Regex } from "std/regex";

      func test_find_all() -> Result<Bool, String> {
          let log = "2026-08-21 [INFO] req_101 user_alice ip=192.168.1.10 status=200; req_102 user_bob ip=10.0.0.5 status=201; req_103 user_carol ip=172.16.0.1 status=500";
          let ip_pattern = regex.compile("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+")?;
          let matches = ip_pattern.find_all(log);

          print("total_ips_\${matches.len()}");
          for m in matches {
              print("ip_\${m.text}");
          }

          return Result.Ok(true);
      }

      test_find_all();
    `;

    const out = await runFlex(code);
    check("find_all extrai todos os IPs do log", out.includes("total_ips_3") && out.includes("ip_192.168.1.10") && out.includes("ip_10.0.0.5") && out.includes("ip_172.16.0.1"), out);
  }

  // Cenário 3: replace_all mascarando dados sensíveis
  {
    const code = `
      import { regex, Regex } from "std/regex";

      func test_masking() -> Result<Bool, String> {
          let card_re = regex.compile("[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}")?;
          let text = "Cartao 1: 5502-0932-1123-9944 aprovado. Cartao 2: 4002-8922-3344-5566 recusado.";
          let masked = card_re.replace_all(text, "****-****-****-****");
          print(masked);
          return Result.Ok(true);
      }

      test_masking();
    `;

    const out = await runFlex(code);
    check("replace_all mascara números de cartões com sucesso", out.includes("Cartao 1: ****-****-****-**** aprovado") && out.includes("Cartao 2: ****-****-****-**** recusado"), out);
  }

  // Cenário 4: split de tokens em protocolo customizado
  {
    const code = `
      import { regex, Regex } from "std/regex";

      func test_split() -> Result<Bool, String> {
          let delim = regex.compile("[|:#]+")?;
          let data = "TXN|PIX#AMOUNT:1500#CURRENCY:BRL";
          let parts = delim.split(data);

          print("parts_len_\${parts.len()}");
          for p in parts {
              print("part_\${p}");
          }
          return Result.Ok(true);
      }

      test_split();
    `;

    const out = await runFlex(code);
    check("split decompõe dados usando múltiplos delimitadores", out.includes("parts_len_6") && out.includes("part_TXN") && out.includes("part_PIX") && out.includes("part_AMOUNT"), out);
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro no teste de integração Regex Engine:", err);
  process.exit(1);
});
