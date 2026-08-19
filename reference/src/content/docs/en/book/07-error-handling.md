---
title: 7. Modern Error Handling
description: Result, Option, propagation operator ?, and inline catch expressions.
---

FlexLang rejects unchecked exceptions (`throw/try/catch`), which obscure control flow. Errors in FlexLang are **explicit, first-class values**.

---

## 🎁 `Result<T, E>` and `Option<T>`

The standard library automatically provides two generic sum types:

```flexlang
enum Result<T, E> {
    Ok(T),
    Err(E)
}

enum Option<T> {
    Some(T),
    None
}
```

Example function returning a `Result`:

```flexlang
func divide(a: Int, b: Int) -> Result<Int, String> {
    if b == 0 {
        return Result.Err("Division by zero not allowed");
    }
    return Result.Ok(a / b);
}
```

---

## ❓ The Propagation Operator (`?`)

The `?` operator extracts the unwrapped payload from `Result.Ok(v)` or `Option.Some(v)`. If the value is `Err(e)` or `None`, it **immediately returns early** from the current function:

```flexlang
func calculate_invoice(user_id: String) -> Result<Float, String> {
    let user = fetch_user(user_id)?; // Early-returns on Err
    let contract = fetch_contract(user.id)?;
    let rate = calculate_rate(contract)?;

    return Result.Ok(rate);
}
```

---

## 🛡️ `catch` Blocks for Inline Fallbacks

When you want to intercept a `Result.Err` at the call-site to supply a fallback value or log without the boilerplate of a `match`:

```flexlang
// Unwraps Ok; executes fallback block on Err
let config = read_config_file("config.json") catch err {
    log.warn("Failed reading config.json, applying default", { error: err });
    default_config()
};
```

Combining `?` with `catch` blocks produces clean, linear, and exception-safe backend logic.
