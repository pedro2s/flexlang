import * as fs from "fs";
import * as path from "path";
import { FlexFormatter } from "../src/formatter/formatter";
import { Lexer } from "../../../src/lexer";
import { Parser } from "../../../src/parser";
import { TypeChecker } from "../../../src/checker";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falha: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Sucesso: ${message}`);
}

console.log("🧪 Iniciando bateria de testes das Ferramentas VSCode da FlexLang...\n");

// 1. Validação de integridade dos arquivos JSON
console.log("--- 1. Validação de Arquivos de Configuração JSON ---");
const baseDir = path.resolve(__dirname, "..");

const pkgJson = JSON.parse(fs.readFileSync(path.join(baseDir, "package.json"), "utf-8"));
assert(pkgJson.name === "vscode-flexlang", "package.json carregado e com nome correto");
assert(Array.isArray(pkgJson.contributes.languages), "package.json contribui linguagens");
assert(Array.isArray(pkgJson.contributes.commands), "package.json contribui comandos");

const langConfig = JSON.parse(fs.readFileSync(path.join(baseDir, "language-configuration.json"), "utf-8"));
assert(langConfig.comments && langConfig.comments.lineComment === "//", "language-configuration define comentários");
assert(Array.isArray(langConfig.brackets), "language-configuration define brackets");

const grammar = JSON.parse(fs.readFileSync(path.join(baseDir, "syntaxes", "flexlang.tmLanguage.json"), "utf-8"));
assert(grammar.scopeName === "source.flex", "Gramática TextMate possui scopeName 'source.flex'");
assert(grammar.repository && grammar.repository.keywords, "Gramática possui repositório de palavras-chave");

const snippets = JSON.parse(fs.readFileSync(path.join(baseDir, "snippets", "flexlang.json"), "utf-8"));
assert(Boolean(snippets["Function Declaration"]), "Snippets contém Function Declaration");
assert(Boolean(snippets["HTTP Server Setup"]), "Snippets contém HTTP Server Setup");
assert(Boolean(snippets["Structured Concurrency Scope"]), "Snippets contém Concurrency Scope");

// 2. Testes do Formatador Oficial (FlexFormatter)
console.log("\n--- 2. Testes do Formatador Oficial ---");
const formatter = new FlexFormatter({ indentSize: 4 });

const unformattedCode = `
func soma(a:Int,b:Int)->Int{
let mut total=a+b;
if(total>10){
print("Maior que dez");
}else{
print("Menor");
}
return total;
}
`;

const formatted = formatter.format(unformattedCode);
console.log("Código Formatado:\n" + formatted);

assert(formatted.includes("func soma(a: Int, b: Int) -> Int {"), "Espaçamento de parâmetros e seta formatado");
assert(formatted.includes("    let mut total = a + b;"), "Indentação interna de 4 espaços aplicada");
assert(formatted.includes("    if (total > 10) {"), "Espaçamento de controle de fluxo if aplicado");
assert(formatted.includes("    } else {"), "Formatação da cláusula else aplicada");

// Teste de formatação com structs e concorrência
const complexCode = `
struct User{
id:Int,
name:String
}

scope{
spawn{
let ch=Channel.new();
ch.send(10);
};
}
`;

const formattedComplex = formatter.format(complexCode);
assert(formattedComplex.includes("struct User {"), "Estrutura struct formatada com espaço antes da chave");
assert(formattedComplex.includes("    id: Int,"), "Campos da struct indentados corretamente");
assert(formattedComplex.includes("    spawn {"), "Bloco de spawn indentado dentro de scope");

// 3. Teste de Diagnósticos em tempo real com o compilador FlexLang
console.log("\n--- 3. Testes de Diagnósticos do Compilador ---");
const validCode = `
func main() {
    let mut x: Int = 10;
    x = 20;
    print(x);
}
`;

const lexer = new Lexer(validCode);
const tokens = lexer.tokenize();
assert(tokens.length > 0, "Tokens gerados com sucesso pelo Lexer");

const parser = new Parser(tokens, "test.flex");
const ast = parser.parse();
assert(ast.length > 0, "AST gerada com sucesso pelo Parser");

const checker = new TypeChecker();
checker.check(ast, "test.flex");
assert(true, "TypeChecker validou código sem erros");

// 4. Testes RFC-017 (else if, break, continue e erro E2032)
console.log("\n--- 4. Testes RFC-017 (else if, break, continue) ---");
const rfc017Code = `
func test_fluxo(x: Int) {
    if x == 1 {
        print("um");
    } else if x == 2 {
        print("dois");
    } else {
        print("outro");
    }

    for i in 0..10 {
        if i == 5 {
            break;
        }
        if i == 3 {
            continue;
        }
    }
}
`;

const rfcTokens = new Lexer(rfc017Code).tokenize();
const rfcAst = new Parser(rfcTokens, "rfc017.flex").parse();
new TypeChecker().check(rfcAst, "rfc017.flex");
assert(true, "RFC-017: else if, break e continue aceitos dentro de laço");

// Validação estática: break fora de laço deve lançar E2032
let caughtE2032 = false;
try {
    const invalidBreakCode = `func main() { break; }`;
    const invTokens = new Lexer(invalidBreakCode).tokenize();
    const invAst = new Parser(invTokens, "invalid.flex").parse();
    new TypeChecker().check(invAst, "invalid.flex");
} catch (err: any) {
    if (err.code === "E2032") {
        caughtE2032 = true;
    }
}
assert(caughtE2032, "RFC-017: 'break' fora de laço emite erro estático E2032");

// 5. Testes RFC-018 (for..in sobre coleções e erro E2033)
console.log("\n--- 5. Testes RFC-018 (for..in sobre coleções) ---");
const rfc018Code = `
func test_for_in() {
    let arr = [10, 20];
    for item, idx in arr {
        print("\${idx}: \${item}");
    }

    let config = { "debug": true };
    for k, v in config {
        print("\${k}: \${v}");
    }
}
`;

const rfc018Tokens = new Lexer(rfc018Code).tokenize();
const rfc018Ast = new Parser(rfc018Tokens, "rfc018.flex").parse();
new TypeChecker().check(rfc018Ast, "rfc018.flex");
assert(true, "RFC-018: for-in com array, map e índices aceitos pelo TypeChecker");

// Validação estática: iterar sobre Int ou Bool deve emitir E2033
let caughtE2033 = false;
try {
    const invalidIterCode = `
    func main() {
        let x = 42;
        for i in x {
            print(i);
        }
    }
    `;
    const invTokens = new Lexer(invalidIterCode).tokenize();
    const invAst = new Parser(invTokens, "invalid_iter.flex").parse();
    new TypeChecker().check(invAst, "invalid_iter.flex");
} catch (err: any) {
    if (err.code === "E2033") {
        caughtE2033 = true;
    }
}
assert(caughtE2033, "RFC-018: iterar sobre tipo não-iterável emite erro estático E2033");

// 6. Testes RFC-019 (Métodos de String e erros estáticos E2024 / E2012)
console.log("\n--- 6. Testes RFC-019 (Métodos de String) ---");
const rfc019Code = `
func test_strings() {
    let s = "  Ola Mundo  ";
    let t = s.trim().to_upper();
    let l = t.len();
    let c = t.contains("OLA");
    let parts = t.split(" ");
    let r = t.replace("OLA", "HELLO");
    let sub = t.substring(0, 3);
    let opt = t.index_of("MUNDO");
}
`;

const rfc019Tokens = new Lexer(rfc019Code).tokenize();
const rfc019Ast = new Parser(rfc019Tokens, "rfc019.flex").parse();
new TypeChecker().check(rfc019Ast, "rfc019.flex");
assert(true, "RFC-019: métodos de String (len, trim, upper, contains, split, replace, substring, index_of) validados");

// Validação estática: método inexistente em String deve emitir E2024
let caughtE2024 = false;
try {
    const invalidMethodCode = `func main() { let s = "abc"; s.metodo_inexistente(); }`;
    const invTokens = new Lexer(invalidMethodCode).tokenize();
    const invAst = new Parser(invTokens, "invalid_str.flex").parse();
    new TypeChecker().check(invAst, "invalid_str.flex");
} catch (err: any) {
    if (err.code === "E2024") {
        caughtE2024 = true;
    }
}
assert(caughtE2024, "RFC-019: método inexistente em String emite erro estático E2024");

// Validação estática: aridade incorreta em método de String deve emitir E2012
let caughtE2012 = false;
try {
    const invalidArityCode = `func main() { let s = "abc"; s.len(10); }`;
    const invTokens = new Lexer(invalidArityCode).tokenize();
    const invAst = new Parser(invTokens, "invalid_arity.flex").parse();
    new TypeChecker().check(invAst, "invalid_arity.flex");
} catch (err: any) {
    if (err.code === "E2012") {
        caughtE2012 = true;
    }
}
assert(caughtE2012, "RFC-019: aridade incorreta em método de String emite erro estático E2012");

// 7. Testes RFC-020 (Métodos de Array, mutabilidade E3001 e métodos funcionais)
console.log("\n--- 7. Testes RFC-020 (Métodos de Array) ---");
const rfc020Code = `
func test_arrays() {
    let mut arr = [10, 20, 30];
    let l = arr.len();
    let empty = arr.is_empty();
    let c = arr.contains(20);
    let sub = arr.slice(0, 2);
    let concat_arr = arr.concat([40, 50]);

    arr.push(40);
    arr.sort();
    let popped = arr.pop();

    let doubled = arr.map(|x| { return x * 2; });
    let filtered = arr.filter(|x| { return x > 10; });
    let found = arr.find(|x| { return x == 20; });
    arr.for_each(|x| { print("\${x}"); });
}
`;

const rfc020Tokens = new Lexer(rfc020Code).tokenize();
const rfc020Ast = new Parser(rfc020Tokens, "rfc020.flex").parse();
new TypeChecker().check(rfc020Ast, "rfc020.flex");
assert(true, "RFC-020: métodos de Array (len, is_empty, contains, slice, concat, push, sort, pop, map, filter, find, for_each) validados");

// Validação estática: mutação em array imutável deve emitir E3001
let caughtE3001 = false;
try {
    const invalidMutCode = `func main() { let arr = [1, 2]; arr.push(3); }`;
    const invTokens = new Lexer(invalidMutCode).tokenize();
    const invAst = new Parser(invTokens, "invalid_mut.flex").parse();
    new TypeChecker().check(invAst, "invalid_mut.flex");
} catch (err: any) {
    if (err.code === "E3001") {
        caughtE3001 = true;
    }
}
assert(caughtE3001, "RFC-020: push em array imutável emite erro estático E3001");

// 8. Testes RFC-021 (Closures com Captura de Escopo)
console.log("\n--- 8. Testes RFC-021 (Closures com Captura) ---");
const rfc021Code = `
func test_closures() {
    let prefix = "Item";
    let mut contador = 0;

    let f = |id: Int| {
        contador = contador + 1;
        return "\${prefix} #\${id}";
    };

    let msg = f(42);

    let base = 100;
    let nivel1 = |a: Int| {
        let nivel2 = |b: Int| {
            return base + a + b;
        };
        return nivel2(20);
    };
    let res = nivel1(5);
}
`;

const rfc021Tokens = new Lexer(rfc021Code).tokenize();
const rfc021Ast = new Parser(rfc021Tokens, "rfc021.flex").parse();
new TypeChecker().check(rfc021Ast, "rfc021.flex");
assert(true, "RFC-021: closures com captura de escopo e closures aninhadas validadas");

// 9. Testes RFC-022 (Conversões de Tipo Explícitas)
console.log("\n--- 9. Testes RFC-022 (Conversões de Tipo) ---");
const rfc022Code = `
func test_conversions() {
    let n = 42;
    let sn = n.to_string();
    let f = 3.14;
    let sf = f.to_string();
    let b = true;
    let sb = b.to_string();

    let pi_res = parse_int("123");
    let pf_res = parse_float("3.14");
}
`;

const rfc022Tokens = new Lexer(rfc022Code).tokenize();
const rfc022Ast = new Parser(rfc022Tokens, "rfc022.flex").parse();
new TypeChecker().check(rfc022Ast, "rfc022.flex");
assert(true, "RFC-022: to_string() para Int, Float, Bool e parse_int/parse_float validados");

// Validação estática: aridade incorreta em parse_int deve emitir E2012
let caughtE2012Conv = false;
try {
    const invCode = `func main() { parse_int("10", "20"); }`;
    const invTokens = new Lexer(invCode).tokenize();
    const invAst = new Parser(invTokens, "invalid_conv.flex").parse();
    new TypeChecker().check(invAst, "invalid_conv.flex");
} catch (err: any) {
    if (err.code === "E2012") {
        caughtE2012Conv = true;
    }
}
assert(caughtE2012Conv, "RFC-022: aridade incorreta em parse_int emite erro estático E2012");

// 10. Testes RFC-023 (HashMap<K, V> Tipado)
console.log("\n--- 10. Testes RFC-023 (HashMap Tipado) ---");
const rfc023Code = `
func test_hashmap() {
    let mut mapa: HashMap<String, Int> = HashMap.new();
    mapa.set("Alice", 100);
    let val = mapa.get("Alice");
    let rem = mapa.remove("Alice");
    let has = mapa.contains_key("Alice");
    let l = mapa.len();
    let empty = mapa.is_empty();
    let k = mapa.keys();
    let v = mapa.values();

    let config = HashMap.from({ "host": "localhost" });
}
`;

const rfc023Tokens = new Lexer(rfc023Code).tokenize();
const rfc023Ast = new Parser(rfc023Tokens, "rfc023.flex").parse();
new TypeChecker().check(rfc023Ast, "rfc023.flex");
assert(true, "RFC-023: HashMap (new, from, get, set, remove, contains_key, len, is_empty, keys, values) validado");

// Validação estática: set em HashMap imutável deve emitir E3001
let caughtE3001Map = false;
try {
    const invMapCode = `func main() { let m: HashMap<String, Int> = HashMap.new(); m.set("k", 1); }`;
    const invMapTokens = new Lexer(invMapCode).tokenize();
    const invMapAst = new Parser(invMapTokens, "invalid_map.flex").parse();
    new TypeChecker().check(invMapAst, "invalid_map.flex");
} catch (err: any) {
    if (err.code === "E3001") {
        caughtE3001Map = true;
    }
}
assert(caughtE3001Map, "RFC-023: set em HashMap imutável emite erro estático E3001");

// 11. Testes RFC-024 (Declarações const de Nível de Módulo)
console.log("\n--- 11. Testes RFC-024 (Declarações const) ---");
const rfc024Code = `
const MAX_RETRIES = 3;
const TAX_RATE = 0.15;
const BANK_NAME = "FlexBank S.A.";
const IS_PROD = true;
const MAX_LIMIT: Int = 10000;

func test_consts() {
    let x = MAX_RETRIES + MAX_LIMIT;
}
`;

const rfc024Tokens = new Lexer(rfc024Code).tokenize();
const rfc024Ast = new Parser(rfc024Tokens, "rfc024.flex").parse();
new TypeChecker().check(rfc024Ast, "rfc024.flex");
assert(true, "RFC-024: declarações const de nível de módulo validadas");

// Validação estática: reatribuição de const deve emitir E3003
let caughtE3003 = false;
try {
    const invConstCode = `const TAX = 0.1; func main() { TAX = 0.2; }`;
    const invConstTokens = new Lexer(invConstCode).tokenize();
    const invConstAst = new Parser(invConstTokens, "invalid_const.flex").parse();
    new TypeChecker().check(invConstAst, "invalid_const.flex");
} catch (err: any) {
    if (err.code === "E3003") {
        caughtE3003 = true;
    }
}
assert(caughtE3003, "RFC-024: reatribuição de const emite erro estático E3003");

// Validação estática: const com inicializador não-literal deve emitir E2034
let caughtE2034 = false;
try {
    const invInitCode = `func get_val() -> Int { return 10; } const TAX = get_val();`;
    const invInitTokens = new Lexer(invInitCode).tokenize();
    const invInitAst = new Parser(invInitTokens, "invalid_init.flex").parse();
    new TypeChecker().check(invInitAst, "invalid_init.flex");
} catch (err: any) {
    if (err.code === "E2034") {
        caughtE2034 = true;
    }
}
assert(caughtE2034, "RFC-024: const inicializada com função emite erro estático E2034");

// 12. Testes RFC-025 (Módulo math/decimal)
console.log("\n--- 12. Testes RFC-025 (Módulo math/decimal) ---");
const rfc025Code = `
import { Decimal } from "math/decimal";

func test_decimal_suite() -> Result<Decimal, String> {
    let d1 = Decimal.new("100.50");
    let d2 = Decimal.from_int(2);
    let soma = d1.add(d2);
    let sub = d1.sub(d2);
    let mul = d1.mul(d2);
    let div = d1.div(d2)?;
    let rem = d1.modulo(d2);
    let neg = d1.neg();
    let abs = d1.abs();
    let r = d1.round(1);
    let p = d2.pow(3);
    let eq = d1.eq(d2);
    let is_z = d1.is_zero();
    let s = d1.to_string();
    let f = d1.to_float();
    let n = d1.to_int();
    return Result.Ok(div);
}
`;

const rfc025Tokens = new Lexer(rfc025Code).tokenize();
const rfc025Ast = new Parser(rfc025Tokens, "rfc025.flex").parse();
new TypeChecker().check(rfc025Ast, "rfc025.flex");
assert(true, "RFC-025: módulo math/decimal com todas as operações e Result validado");

// 13. Testes RFC-026 (Módulo os/env)
console.log("\n--- 13. Testes RFC-026 (Módulo os/env) ---");
const rfc026Code = `
import { env } from "os/env";

func test_env_suite() {
    let port = env.get_or("PORT", "3000");
    let missing = env.get("MISSING");
    let req = env.require("PATH");
    let has_p = env.has("PATH");
}
`;

const rfc026Tokens = new Lexer(rfc026Code).tokenize();
const rfc026Ast = new Parser(rfc026Tokens, "rfc026.flex").parse();
new TypeChecker().check(rfc026Ast, "rfc026.flex");
assert(true, "RFC-026: módulo os/env com get, get_or, require, has validado");

// 14. Testes RFC-027 (Módulo core/time)
console.log("\n--- 14. Testes RFC-027 (Módulo core/time) ---");
const rfc027Code = `
import { Time, Duration } from "core/time";

func test_time_suite() {
    let now = Time.now();
    let epoch = Time.from_unix(0);
    let u = now.unix();
    let um = now.unix_millis();
    let iso = now.iso8601();
    let fmt = now.format("YYYY-MM-DD");

    let d_sec = Duration.seconds(10);
    let d_ms = Duration.millis(500);
    let d_min = Duration.minutes(2);
    let d_h = Duration.hours(1);

    let sec_val = d_sec.as_seconds();
    let ms_val = d_sec.as_millis();

    let future = epoch.add_duration(d_h);
    let diff = future.sub(epoch);
    let is_b = epoch.before(future);
    let is_a = future.after(epoch);
}
`;

const rfc027Tokens = new Lexer(rfc027Code).tokenize();
const rfc027Ast = new Parser(rfc027Tokens, "rfc027.flex").parse();
new TypeChecker().check(rfc027Ast, "rfc027.flex");
assert(true, "RFC-027: módulo core/time com Time e Duration validado");

console.log("\n✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!");
