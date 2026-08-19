---
title: 3. Controle de Fluxo
description: Domine if, else if, while, for..in e controle de laços na FlexLang.
---

# Controle de Fluxo

A FlexLang oferece estruturas de controle de fluxo limpas e previsíveis.

---

## 🔀 Condicionais: `if`, `else if` e `else`

As ramificações condicionais não exigem parênteses em torno da expressão:

```flexlang
let score = 85;

if score >= 90 {
    print("Excelente! Grau A");
} else if score >= 80 {
    print("Muito Bom! Grau B");
} else if score >= 70 {
    print("Bom! Grau C");
} else {
    print("Precisa Melhorar");
}
```

---

## 🔁 Laços: `for..in` em Coleções

O laço `for..in` permite iterar sobre arrays, ranges numéricos e dicionários (`HashMap`):

### Iterando sobre Arrays
```flexlang
let frutas = ["Manga", "Banana", "Abacaxi"];

for fruta in frutas {
    print("Fruta: ${fruta}");
}
```

### Iterando sobre Ranges Numéricos
```flexlang
for i in 1..5 {
    print("Contagem: ${i}"); // Imprime de 1 a 4
}
```

### Iterando sobre HashMaps (Chave e Valor)
```flexlang
let capitais = HashMap.from({
    "BR": "Brasília",
    "PT": "Lisboa",
    "US": "Washington"
});

for pais, capital in capitais {
    print("País: ${pais} -> Capital: ${capital}");
}
```

---

## 🔄 Laço `while`

O laço `while` executa um bloco enquanto a condição for verdadeira:

```flexlang
let mut i = 0;
while i < 5 {
    print("Iteração: ${i}");
    i = i + 1;
}
```

---

## ⏹️ `break` e `continue`

Você pode interromper ou pular iterações em laços `while` e `for`:

```flexlang
for n in 1..10 {
    if n % 2 == 0 {
        continue; // Pula números pares
    }
    if n > 7 {
        break; // Interrompe o loop
    }
    print("Ímpar: ${n}");
}
```
