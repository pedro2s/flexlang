---
title: Coleções & Métodos Nativos
description: Métodos utilitários de alta performance para Strings, Arrays e HashMaps.
---

A FlexLang possui uma rica biblioteca de métodos integrados para manipulação de textos, listas e mapas.

---

## 🔤 Métodos de String

```flexlang
let texto = "  FlexLang Backend  ";

texto.len();                       // 20
texto.trim();                      // "FlexLang Backend"
texto.to_lowercase();              // "  flexlang backend  "
texto.to_uppercase();              // "  FLEXLANG BACKEND  "
texto.contains("Backend");         // true
texto.starts_with("  Flex");       // true
texto.ends_with("end  ");          // true
texto.replace("Backend", "Core");  // "  FlexLang Core  "
texto.substring(2, 10);            // "FlexLang"
texto.index_of("Lang");            // 6 (ou -1 se não encontrar)
"a,b,c".split(",");                // ["a", "b", "c"]
```

---

## 📋 Métodos de Array

```flexlang
let mut numeros = [10, 20, 30];

numeros.len();                  // 3
numeros.is_empty();             // false
numeros.contains(20);           // true

// Modificações em arrays mutáveis
numeros.push(40);               // [10, 20, 30, 40]
let ultimo = numeros.pop();     // 40

// Fatiamento e Combinação
let sub = numeros.slice(0, 2);  // [10, 20]
let unidos = numeros.concat([99, 100]);

// Métodos Funcionais com Closures
let dobrados = numeros.map(|n| { return n * 2; });
let filtrados = numeros.filter(|n| { return n > 15; });
```

---

## 🗺️ Métodos de `HashMap`

```flexlang
// Construtores
let mut mapa = HashMap.new();
let config = HashMap.from({
    "host": "localhost",
    "port": "8080"
});

// Operações
mapa.set("chave", "valor");
let valor = mapa.get("chave");       // Option.Some("valor")
mapa.contains_key("chave");          // true
mapa.len();                          // 1
mapa.is_empty();                     // false

let chaves = mapa.keys();            // ["chave"]
let valores = mapa.values();         // ["valor"]

let removido = mapa.remove("chave"); // Option.Some("valor")
```
