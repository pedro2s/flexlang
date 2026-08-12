// Teste 04: Regras de Mutabilidade

struct Person {
    age: Int
}

let mut x = 10;
x = 20; // OK: x é mutável
print(x);

let p = Person { age: 30 };

// ISSO DEVE FALHAR EM TEMPO DE COMPILAÇÃO!
// p não foi declarada com `mut`, então não podemos alterar propriedades internas.
p.age = 40;
