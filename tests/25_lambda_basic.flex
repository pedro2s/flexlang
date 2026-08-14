// Teste 25: Lambda expressions (closures inline)
// Testa a sintaxe |param: Type| { body } como expressão, armazenamento em
// variável, captura de closure, e passagem como argumento.

// 1. Lambda armazenada em variável e invocada via callFunction
let greet = |name: String| {
    print("ola ${name}");
};

// 2. Lambda capturando variável do escopo (closure)
let prefix = "resultado";
let show = |x: Int| {
    print("${prefix}: ${x}");
};

// Executar as lambdas
greet("mundo");
show(42);

// 3. Lambda sem parâmetros
let hello = || {
    print("lambda vazia");
};
hello();

print("fim");
