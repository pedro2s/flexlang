import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";

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

async function main() {
  console.log("\n== Teste de Integração: Módulo de Validação Declarativa (RFC-037) ==");

  const flexCode = `
    import { validator, ValidationError } from "std/validator";

    // 1. Validações Primitivas
    let cpf_valido = validator.cpf("52998224725");
    let cpf_pontuado = validator.cpf("529.982.247-25");
    let cpf_invalido = validator.cpf("111.111.111-11");
    let cpf_digito_errado = validator.cpf("529.982.247-26");

    let cnpj_valido = validator.cnpj("11.222.333/0001-81");
    let cnpj_invalido = validator.cnpj("00.000.000/0000-00");
    let cnpj_digito_errado = validator.cnpj("11.222.333/0001-82");

    let email_valido = validator.email("pedro@flexbank.com.br");
    let email_invalido = validator.email("pedro.flexbank");

    let uuid_valido = validator.uuid("550e8400-e29b-41d4-a716-446655440000");
    let uuid_invalido = validator.uuid("550e8400-not-a-uuid");

    print("cpf_valido: \${cpf_valido}");
    print("cpf_pontuado: \${cpf_pontuado}");
    print("cpf_invalido: \${cpf_invalido}");
    print("cpf_digito_errado: \${cpf_digito_errado}");

    print("cnpj_valido: \${cnpj_valido}");
    print("cnpj_invalido: \${cnpj_invalido}");
    print("cnpj_digito_errado: \${cnpj_digito_errado}");

    print("email_valido: \${email_valido}");
    print("email_invalido: \${email_invalido}");

    print("uuid_valido: \${uuid_valido}");
    print("uuid_invalido: \${uuid_invalido}");

    // 2. Validador com Builder (DTO de Sucesso)
    let mut v_ok = validator.new();
    v_ok.field("nome", "Carlos Silva")
        .required()
        .min_len(3)
        .max_len(50);
    v_ok.field("cpf", "52998224725")
        .required()
        .cpf();
    v_ok.field("email", "carlos@example.com")
        .required()
        .email();

    match v_ok.result() {
      Result.Ok(_) { print("v_ok: PASSOU"); },
      Result.Err(errs) { print("v_ok: FALHOU"); }
    }

    // 3. Validador com Builder (DTO com Múltiplos Erros)
    let mut v_err = validator.new();
    v_err.field("nome", "Al")
         .required()
         .min_len(3)
         .max_len(50);
    v_err.field("cpf", "111.111.111-11")
         .required()
         .cpf();
    v_err.field("email", "invalido")
         .required()
         .email();
    v_err.field("obs", "Texto muito longo que ultrapassa dez")
         .max_len(10);
    v_err.add_error("custom_field", "Erro customizado de regra de negócio");

    match v_err.result() {
      Result.Ok(_) { print("v_err: PASSOU INESPERADAMENTE"); },
      Result.Err(errs) {
        print("v_err: ERROS ENCONTRADOS (\${errs.len()})");
        for err in errs {
          print("campo: \${err.field} | msg: \${err.message}");
        }
      }
    }
  `;

  const ast = new Parser(new Lexer(flexCode).tokenize()).parse();
  new TypeChecker().check(ast);

  let output = "";
  const interpreter = new Interpreter((msg) => {
    output += msg + "\n";
  });
  await interpreter.run(ast);

  check("CPF válido validado corretamente", output.includes("cpf_valido: true") && output.includes("cpf_pontuado: true"));
  check("CPF inválido e sequencial rejeitados", output.includes("cpf_invalido: false") && output.includes("cpf_digito_errado: false"));
  check("CNPJ válido validado corretamente", output.includes("cnpj_valido: true"));
  check("CNPJ inválido e sequencial rejeitados", output.includes("cnpj_invalido: false") && output.includes("cnpj_digito_errado: false"));
  check("E-mail validado corretamente", output.includes("email_valido: true") && output.includes("email_invalido: false"));
  check("UUID v4 validado corretamente", output.includes("uuid_valido: true") && output.includes("uuid_invalido: false"));
  check("Validação de DTO válido sem erros", output.includes("v_ok: PASSOU"));
  check("Validação de DTO inválido agregando todos os erros", output.includes("v_err: ERROS ENCONTRADOS (5)") && output.includes("campo: custom_field"));

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
