---
title: os/env — Environment Variables
description: Secure reading, default values, and strict validation for environment variables.
---

# `os/env` — Environment Variables

The `os/env` module provides access to environment configuration and secret variables injected into production containers.

```flexlang
import { env } from "os/env";
```

---

## 📋 API Methods

| Method | Signature | Return | Description |
|---|---|---|---|
| `get` | `env.get(name: String)` | `Option<String>` | Reads variable as `Some(val)` or `None` if missing. |
| `get_or` | `env.get_or(name: String, default: String)` | `String` | Reads variable or falls back to supplied default. |
| `require` | `env.require(name: String)` | `Result<String, String>` | Returns `Ok(val)` or `Err` if required variable is missing. |
| `has` | `env.has(name: String)` | `Bool` | Checks whether variable is defined in the environment. |

---

## 💡 Example: Configuration Loader

```flexlang
import { env } from "os/env";

struct AppConfig {
    port: String,
    database_url: String,
    debug_mode: Bool
}

func load_config() -> Result<AppConfig, String> {
    let port = env.get_or("PORT", "8080");
    let db_url = env.require("DATABASE_URL")?;
    let debug = env.has("DEBUG");

    return Result.Ok(AppConfig {
        port: port,
        database_url: db_url,
        debug_mode: debug
    });
}
```
