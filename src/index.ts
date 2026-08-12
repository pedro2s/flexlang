import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Interpreter } from "./interpreter";

const sourceCode = `
func add(a: Int, b: Int) -> Int {
 return a + b;
}

let x: Int = 10;
let y = 20;
let resultado = add(x, y);
print(resultado);

let limite = 3;

if limite > 2 {
    print("Limite é maior que 2");
} else {
    print("Limite pequeno");
}

for i in 0..limite {
    print(i);
}

struct Point {
    x: Int,
    y: Int
}

let p1 = Point { x: 10, y: 20 };
let p2 = Point { x: 5, y: 15 };

print(p1.x + p2.y);

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
