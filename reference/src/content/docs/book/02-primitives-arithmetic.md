---
title: 2. Tipos Primitivos & Aritmética Estrita
description: Tipos primitivos, IEEE-754 Float, inteiros e segurança aritmética na FlexLang.
---

# Tipos Primitivos & Aritmética Estrita

A FlexLang possui um sistema de tipos primitivos conciso e focado em evitar comportamentos indefinidos ou truncamentos acidentais.

---

## 🔢 Tipos Primitivos

| Tipo | Descrição | Exemplo |
|---|---|---|
| `Int` | Inteiro com sinal de 64 bits | `42`, `-10`, `0` |
| `Float` | Ponto flutuante IEEE-754 de 64 bits (`float64`) | `3.1415`, `0.5`, `-12.8` |
| `String` | Texto UTF-8 com suporte a interpolação | `"Olá, ${nome}!"` |
| `Bool` | Booleano lógico | `true`, `false` |

---

## 🧮 Operadores Aritméticos

A FlexLang suporta os operadores padrão: `+`, `-`, `*`, `/` e `%`.

```flexlang
let soma = 10 + 5;        // 15 (Int)
let sub = 20 - 4;         // 16 (Int)
let mult = 6 * 7;         // 42 (Int)
let div_inteira = 7 / 2;  // 3 (Divisão inteira trunca para Int)
let resto = 7 % 2;        // 1 (Int)

let preco = 19.90;
let frete = 5.50;
let total = preco + frete; // 25.40 (Float)
```

---

## 🛑 Sem Coerção Implícita de Tipos

Para garantir que o código execute com **100% de paridade** entre o modo interpretado e o binário compilado Go, a FlexLang **proíbe coerção implícita** entre `Int` e `Float`:

```flexlang
let a: Int = 10;
let b: Float = 2.5;

// ERRO DE COMPILAÇÃO: Operator '+' requires operands of the same type (Int and Float)
// let c = a + b;

// FORMA CORRETA: Conversão explícita
let c = a.to_float() + b; // 12.5 (Float)
```

### O Operador Módulo (`%`)
O operador `%` só é permitido em tipos inteiros (`Int`). Tentar aplicar `%` em `Float` emite o erro `E2030`:

```flexlang
let x = 10 % 3; // OK: 1

// let f = 10.5 % 2.0; // ERRO: Operator % is not supported for Float. Use to_int()
```

---

## 📝 Interpolação de Strings

Strings suportam interpolação dinâmica de qualquer expressão através da sintaxe `"${expr}"`:

```flexlang
let user = "Alice";
let score = 95;

print("Jogador: ${user}, Pontuação: ${score + 5}");
// Imprime: Jogador: Alice, Pontuação: 100
```
