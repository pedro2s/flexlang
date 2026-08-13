// Teste 14: Arrays de struct, indexacao, operadores unarios encadeados e limites de laco

struct Item {
    preco: Int
}

// Array cujo tipo de elemento e uma struct (o transpiler precisa do tipo
// resolvido pelo checker para emitir []*Item em vez de []any)
let itens = [Item { preco: 10 }, Item { preco: 25 }];
print(itens[0].preco);
print(itens[1].preco);

let mut nums = [1, 2, 3];
nums[2] = 30;
print(nums[0] + nums[2]);

// Unarios encadeados: `--x` nao pode virar o operador `--` do Go
let x = 5;
let d = --x;
print(d);
print(-x);

let t = !!true;
print(t);
print(!t);

// O limite do laco e avaliado uma unica vez, antes da primeira iteracao
let mut n = 3;
for i in 0..n {
    n = n + 1;
    print(i);
}
print(n);
