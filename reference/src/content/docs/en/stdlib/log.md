---
title: core/log — Structured Logging & Security
description: Structured JSON logging with ISO 8601 timestamps and automatic secret masking.
---

The `core/log` module outputs structured JSON directly to standard streams with active security sanitization for secrets and passwords.

```flexlang
import { log } from "core/log";
```

---

## 🪵 Log Levels

```flexlang
log.info("Server started successfully", { port: 8080, env: "production" });
log.warn("Login attempt with suspicious payload", { ip: "192.168.1.50" });
log.error("Payment gateway communication timeout", { code: 504 });
log.debug("Received request params", { query: "limit=10" });
```

### JSON Output Format:
```json
{"level":"info","msg":"Server started successfully","ts":"2026-08-18T22:00:00.000Z","port":8080,"env":"production"}
```

---

## 🔒 Automatic Secret Masking (RFC-009)

The logger inspects structured metadata keys and sanitizes sensitive fields with `"***"`:

### Automatically Masked Keys (Case-Insensitive):
- `password`, `pass`
- `token`, `auth`, `authorization`
- `secret`, `api_key`

```flexlang
// Pass the full payload naturally:
log.info("Authentication attempt", {
    user: "alice",
    password: "super_secret_password",
    api_key: "ak_live_8912301283"
});

// Serialized output masks sensitive fields:
// {"level":"info","msg":"Authentication attempt","ts":"...","user":"alice","password":"***","api_key":"***"}
```
