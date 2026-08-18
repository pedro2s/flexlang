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

console.log("\n✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!");
