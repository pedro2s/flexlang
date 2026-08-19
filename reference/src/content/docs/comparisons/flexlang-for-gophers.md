---
title: FlexLang para Desenvolvedores Go
description: Comparativo direto entre Go e FlexLang — Concorrência Estruturada, Result/match, e fim do 'if err != nil'.
---

# FlexLang para Desenvolvedores Go

Se você programa em Go, vai se sentir em casa na FlexLang. A linguagem mantém o modelo de execução leve com goroutines e GC de baixa pausa, mas resolve os três maiores pontos de dor do Go.

---

## 🥊 Tabela Comparativa

| Recurso | Em Go | Na FlexLang |
|---|---|---|
| **Tratamento de Erros** | `if err != nil { return nil, err }` repetitivo | `Result<T, E>`, operador `?` e blocos `catch` |
| **Sum Types / Enums** | `const` + `iota` (sem payloads tipados) | `enum` com payloads posicionais e `match` exaustivo |
| **Concorrência** | `go func()` solto + `context.Context` viral | Concorrência estruturada com `scope` e `spawn` |
| **Imutabilidade** | Tudo mutável por padrão (exceto constantes) | `let` imutável por padrão; `let mut` explícito |
| **Data Races** | Race detector em runtime (`-race`) | Verificado em compilação (*Move Semantics* em canais) |

---

## ⚡ Exemplo Prático: Tratamento de Erros

### Em Go:
```go
user, err := findUser(id)
if err != nil {
    return nil, err
}

order, err := findOrder(user.ID)
if err != nil {
    return nil, err
}
```

### Na FlexLang:
```flexlang
let user = find_user(id)?;
let order = find_order(user.id)?;
```
