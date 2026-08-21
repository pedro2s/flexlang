---
title: std/regex — Expressões Regulares RE2
description: Motor nativo de expressões regulares com garantia de complexidade linear O(n) e imunidade a ataques de ReDoS.
---

O módulo `std/regex` oferece expressões regulares seguras de alta performance com complexidade linear $O(n)$ garantida pelo motor RE2 na compilação Go e verificações rigorosas no interpretador.

```flexlang
import { regex, Regex, MatchResult } from "std/regex";
```

---

## 🎯 1. Verificação Rápida (`is_match`)

```flexlang
// Verificação simples retornando Result<Bool, String>
let is_match_res = regex.is_match("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", "alice@flexbank.dev");
match is_match_res {
    Result.Ok(matches) {
        print("Email válido: ${matches}"); // true
    },
    Result.Err(err) {
        print("Padrão regex inválido: ${err}");
    }
}
```

---

## 🔍 2. Objeto Compilado `Regex`

Para padrões reutilizados em loops ou requisições HTTP de alta concorrência:

```flexlang
let re = regex.compile("(?P<ddd>\\d{2})-(?P<numero>\\d{4,5}-\\d{4})")?;

// 1. Casamento booleano rápido
if (re.matches("11-99812-3456")) {
    print("Telefone válido");
}

// 2. Busca da primeira ocorrência (retorna Option<MatchResult>)
let match_opt = re.find("Contato: 11-99812-3456");
match match_opt {
    Option.Some(m) {
        print("Encontrado: ${m.text} na posição ${m.start}");
    },
    Option.None {
        print("Nenhum telefone encontrado");
    }
}

// 3. Substituição e Divisão
let clean_text = re.replace_all("Ligue 11-99812-3456 ou 21-98765-4321", "[TELEFONE]");
let parts = regex.compile(",")?.split("apple,banana,orange");
```
