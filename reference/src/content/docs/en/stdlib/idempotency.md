---
title: finance/idempotency — Idempotency Engine
description: Deduplicating payment transactions, atomic locking, and caching responses for exactly-once guarantees.
---

The `finance/idempotency` module guarantees exactly-once execution semantics for financial transfers, Pix settlements, and high-value payment APIs.

```flexlang
import { IdempotencyEngine, IdempotencyConfig, CachedResponse, IdempotencyLock } from "finance/idempotency";
import { Duration } from "core/time";
```

---

## 🔒 1. Setup & Initialization

```flexlang
let engine = IdempotencyEngine.new(IdempotencyConfig {
    storage: "memory",
    ttl: Duration.seconds(300),
    header_name: "Idempotency-Key",
    lock_timeout: Duration.seconds(10)
})?;
```

---

## ⚡ 2. Safe Transaction Flow

```flexlang
server.post("/pix/pay", |req: Request, mut res: Response| {
    let idem_key = req.header("Idempotency-Key").unwrap_or("");
    if (idem_key == "") {
        res.error(400, "Idempotency-Key header is required");
        return;
    }

    // 1. Cache Check
    let cached_opt = engine.check(idem_key)?;
    if (cached_opt.is_some()) {
        let cached = cached_opt.unwrap();
        res.status(cached.status).json(cached.body);
        return;
    }

    // 2. Atomic Lock
    let lock_res = engine.start_processing(idem_key);
    match lock_res {
        Result.Ok(lock) {
            let response_body = { status: "PROCESSED", tx_id: "tx_991823" };
            engine.save_completed(idem_key, 200, response_body)?;
            lock.release();
            res.status(200).json(response_body);
        },
        Result.Err(err) {
            res.error(409, "Transaction already in processing");
        }
    }
});
```
