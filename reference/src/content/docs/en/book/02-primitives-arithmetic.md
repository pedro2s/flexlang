---
title: 2. Primitive Types & Arithmetic
description: Primitive types, IEEE-754 Floats, Integers, and strict arithmetic parity in FlexLang.
---

# Primitive Types & Strict Arithmetic

FlexLang provides a concise primitive type system designed to prevent undefined behavior and unexpected truncation bugs.

---

## 🔢 Primitive Types

| Type | Description | Example |
|---|---|---|
| `Int` | 64-bit signed integer | `42`, `-10`, `0` |
| `Float` | 64-bit IEEE-754 floating point (`float64`) | `3.1415`, `0.5`, `-12.8` |
| `String` | UTF-8 text with interpolation | `"Hello, ${name}!"` |
| `Bool` | Logical boolean | `true`, `false` |

---

## 🧮 Arithmetic Operators

Standard arithmetic operators are supported: `+`, `-`, `*`, `/`, and `%`.

```flexlang
let sum = 10 + 5;           // 15 (Int)
let sub = 20 - 4;           // 16 (Int)
let mul = 6 * 7;            // 42 (Int)
let integer_div = 7 / 2;    // 3 (Integer division truncates)
let remainder = 7 % 2;      // 1 (Int)

let price = 19.90;
let shipping = 5.50;
let total = price + shipping; // 25.40 (Float)
```

---

## 🛑 No Implicit Type Coercion

To guarantee **100% execution parity** between interpreted and compiled Go binaries, FlexLang **disallows implicit coercion** between `Int` and `Float`:

```flexlang
let a: Int = 10;
let b: Float = 2.5;

// COMPILATION ERROR: Operator '+' requires operands of the same type (Int and Float)
// let c = a + b;

// CORRECT: Explicit conversion
let c = a.to_float() + b; // 12.5 (Float)
```

### The Modulo Operator (`%`)
The `%` operator is restricted to `Int`. Applying `%` to `Float` values triggers error `E2030`:

```flexlang
let x = 10 % 3; // OK: 1

// let f = 10.5 % 2.0; // ERROR: Operator % is not supported for Float. Use to_int()
```

---

## 📝 String Interpolation

Strings support dynamic evaluation of arbitrary expressions via `"${expr}"`:

```flexlang
let user = "Alice";
let score = 95;

print("Player: ${user}, Final Score: ${score + 5}");
// Prints: Player: Alice, Final Score: 100
```
