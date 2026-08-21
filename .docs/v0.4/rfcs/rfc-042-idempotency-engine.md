# RFC-042 — Motor de Idempotência e Transações Financeiras (`finance/idempotency`)

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** RFC-036 (`db/redis`), RFC-027 (`core/time`)

---

## 1. Motivação

Em pagamentos, transferências Pix e emissão de boletos, clientes móveis ou sistemas integradores podem enviar a mesma requisição repetidamente devido a instabilidades de rede (*network retries*).

Sem um **Motor de Idempotência**:
- O usuário clica duas vezes no botão "Pagar" e o dinheiro é debitado **duas vezes**.
- Um retry automático de rede gera uma transferência duplicada.

---

## 2. Design da API

```flexlang
import { IdempotencyEngine, IdempotencyConfig } from "finance/idempotency";
import { Redis } from "db/redis";
import { Duration } from "core/time";

let idempotency = IdempotencyEngine.new(IdempotencyConfig {
    storage: redis,                         // Armazenamento chave-valor compartilhado
    ttl: Duration.hours(24),                // Guarda a resposta da transação por 24h
    header_name: "Idempotency-Key"          // Cabeçalho HTTP esperado
});
```

---

### 2.2 Middleware de Idempotência Automática

```flexlang
server.post("/transfers", |req, mut res| {
    let key = req.header("Idempotency-Key");
    match key {
        Option.Some(idempotency_key) {
            // Verifica se a transação já foi processada anteriormente
            let cached_response = idempotency.check(idempotency_key)?;
            match cached_response {
                Option.Some(prev_res) {
                    // Retorna exatamente a resposta anterior sem reprocessar débito!
                    res.status(prev_res.status).json(prev_res.body);
                    return;
                },
                Option.None {
                    // Nova transação! Adquire lock de processamento
                    let lock = idempotency.start_processing(idempotency_key)?;

                    // Executa a transferência no banco...
                    let transfer_result = process_transfer(req.json()?);

                    // Salva a resposta final associada à chave de idempotência
                    idempotency.save_completed(idempotency_key, 201, transfer_result)?;
                    res.status(201).json(transfer_result);
                }
            }
        },
        Option.None {
            res.status(400).json({ error: "MISSING_IDEMPOTENCY_KEY" });
        }
    }
});
```

---

## 3. Implementação e Paridade

- Utiliza padrão IETF Draft `Idempotency-Key` HTTP Header.
- Estados de chave: `PROCESSING` (lock ativo) e `COMPLETED` (payload persistido).
- Parity gate completo.
