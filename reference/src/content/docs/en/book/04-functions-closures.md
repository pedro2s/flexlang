---
title: 4. Functions & Closures
description: Function signatures, return types, mutable parameters, and closures with lexical capture.
---

Functions are first-class citizens in FlexLang. They can be passed as arguments, returned from other functions, and stored in data structures.

---

## 📌 Function Declarations

Functions are declared with `func`. The return type is declared using the arrow `->`:

```flexlang
func add(a: Int, b: Int) -> Int {
    return a + b;
}

func greet(name: String) {
    print("Hello, ${name}!");
}
```

---

## ✏️ Mutable Parameters (`mut`)

Function parameters are immutable by default. To mutate an argument in-place, mark it with `mut`:

```flexlang
struct Account {
    balance: Int
}

func deposit(mut acc: Account, amount: Int) {
    acc.balance = acc.balance + amount;
}
```

---

## ⚡ Closures & Lambdas (`|a, b| { ... }`)

FlexLang supports anonymous functions (lambdas) with **full lexical scope capture**:

```flexlang
let multiplier = 3;

// Lambda capturing 'multiplier' from parent scope
let triple = |x: Int| {
    return x * multiplier;
};

print(triple(10)); // Prints: 30
```

### Functional Array Processing with Closures
Closures integrate directly with functional array methods:

```flexlang
let numbers = [1, 2, 3, 4, 5];

let evens = numbers.filter(|n| {
    return n % 2 == 0;
});

let doubled = numbers.map(|n| {
    return n * 2;
});

print(doubled); // [2, 4, 6, 8, 10]
```

### Inline HTTP Route Handlers
Define HTTP handlers inline cleanly:

```flexlang
server.get("/ping", |req, mut res| {
    res.text("pong");
});
```
