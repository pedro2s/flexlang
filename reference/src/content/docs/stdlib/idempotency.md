---
title: finance/idempotency — Motor de Idempotência Transacional
description: Deduplicação de requisições de pagamento, locks atômicos concorrentes e repetição segura de respostas em cache.
---

O módulo `finance/idempotency` fornece garantias de execução exatamente-uma-vez (*exactly-once semantics*) para transferências financeiras, liquidações Pix e APIs de pagamento.

```flexlang
import { IdempotencyEngine, IdempotencyConfig, CachedResponse, IdempotencyLock } from "finance/idempotency";
import { Duration } from "core/time";
```

---

## 🔒 1. Inicialização do Motor

```flexlang
let engine_res = IdempotencyEngine.new(IdempotencyConfig {
    storage: "memory", // "memory" ou "redis"
    ttl: Duration.seconds(300), // Retenção de resposta por 5 minutos
    header_name: "Idempotency-Key",
    lock_timeout: Duration.seconds(10) // Timeout máximo para adquirir lock
});
let engine = engine_res?;
```

---

## ⚡ 2. Fluxo Transacional Seguro

```flexlang
server.post("/pix/pay", |req: Request, mut res: Response| {
    let idem_key = req.header("Idempotency-Key").unwrap_or("");
    if (idem_key == "") {
        res.error(400, "Idempotency-Key header obrigatório");
        return;
    }

    // 1. Verificação prévia no cache
    let check_res = engine.check(idem_key)?;
    match check_res {
        Option.Some(cached) {
            // Retorna imediatamente a resposta cacheada sem reprocessar débito
            res.status(cached.status).json(cached.body);
            return;
        },
        Option.None {
            // Nova requisição, prossegue para adquirir o lock
        }
    }

    // 2. Adquire lock atômico (evita processamento concorrente duplicado)
    let lock_res = engine.start_processing(idem_key);
    match lock_res {
        Result.Ok(lock) {
            // 3. Executa a liquidação bancária
            let response_body = {
                status: "PROCESSED",
                tx_id: "tx_991823",
                amount: "500.00"
            };

            // 4. Salva resposta para reenvios futuros e libera o lock
            engine.save_completed(idem_key, 200, response_body)?;
            lock.release();

            res.status(200).json(response_body);
        },
        Result.Err(err) {
            // Concorrência detectada: outra thread já está processando este mesmo idempotency key
            res.error(409, "Transação em processamento");
        }
    }
});
```
