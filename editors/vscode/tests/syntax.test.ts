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

console.log("\n✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!");
