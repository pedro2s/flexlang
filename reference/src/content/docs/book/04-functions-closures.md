---
title: 4. Funções e Closures
description: Assinaturas de funções, tipos de retorno, mutabilidade de parâmetros e closures com captura léxica.
---

Funções são cidadãos de primeira classe na FlexLang. Elas podem ser passadas como argumentos, retornadas de outras funções e armazenadas em estruturas.

---

## 📌 Declaração de Funções

Funções são declaradas com a palavra-chave `func`. O tipo de retorno é introduzido com a seta `->`:

```flexlang
func somar(a: Int, b: Int) -> Int {
    return a + b;
}

func saudacao(nome: String) {
    print("Olá, ${nome}!");
}
```

---

## ✏️ Parâmetros Mutáveis (`mut`)

Parâmetros de função são imutáveis por padrão. Caso uma função precise mutar o argumento passado, ele deve ser explicitamente anotado com `mut`:

```flexlang
struct Conta {
    saldo: Int
}

func depositar(mut conta: Conta, valor: Int) {
    conta.saldo = conta.saldo + valor;
}
```

---

## ⚡ Closures e Lambdas (`|a, b| { ... }`)

A FlexLang suporta funções anônimas (lambdas) com **captura léxica completa do ambiente**:

```flexlang
let multiplicador = 3;

// Lambda com captura da variável 'multiplicador' do escopo pai
let triplicar = |x: Int| {
    return x * multiplicador;
};

print(triplicar(10)); // Imprime: 30
```

### Usando Closures com Métodos de Coleção
As closures integram-se perfeitamente com os métodos funcionais de arrays:

```flexlang
let numeros = [1, 2, 3, 4, 5];

let pares = numeros.filter(|n| {
    return n % 2 == 0;
});

let dobrados = numeros.map(|n| {
    return n * 2;
});

print(dobrados); // [2, 4, 6, 8, 10]
```

### Handlers HTTP com Closures Inline
Você pode registrar rotas diretamente com lambdas concisas:

```flexlang
server.get("/ping", |req, mut res| {
    res.text("pong");
});
```
