import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";

const sourceCode = `
let x: Int = 10;
let y = 20;
print(x + y);
`;

console.log("Analisando código fonte da FlexLang...\n");

const lexer = new Lexer(sourceCode);
const tokens = lexer.tokenize();
console.log("Tokens:", tokens);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log("\nAnalisando AST...");
console.log(ast);

const interpreter = new Interpreter();

console.log("\nInterpretando...");
interpreter.run(ast);
