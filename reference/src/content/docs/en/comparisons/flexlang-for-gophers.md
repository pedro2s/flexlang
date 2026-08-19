---
title: FlexLang for Go Developers
description: Direct comparison between Go and FlexLang — Structured Concurrency, Result/match, and no more 'if err != nil'.
---

# FlexLang for Go Developers

If you write Go, you will feel immediately productive with FlexLang. It retains the lightweight goroutine execution model and low-pause GC while resolving Go's biggest pain points.

---

## 🥊 Comparison Table

| Feature | In Go | In FlexLang |
|---|---|---|
| **Error Handling** | Repetitive `if err != nil { return nil, err }` | First-class `Result<T, E>`, `?` operator, and `catch` |
| **Sum Types / Enums** | `const` + `iota` (no typed payloads) | True `enum` with positional payloads & exhaustive `match` |
| **Concurrency** | Orphan `go func()` + viral `context.Context` | Structured concurrency via `scope` and `spawn` |
| **Imutability** | Mutable by default | Immutable `let` by default; explicit `let mut` |
| **Data Races** | Runtime race detector (`-race`) | Compile-time prevention via channel *Move Semantics* |

---

## ⚡ Real Example: Error Handling

### In Go:
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

### In FlexLang:
```flexlang
let user = find_user(id)?;
let order = find_order(user.id)?;
```
