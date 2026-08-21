# RFC-043 — Projeto de Homologação "FlexBank Distributed Ecosystem"

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** Todas as RFCs 031 a 042

---

## 1. Visão Geral do Ecossistema de Validação

Para validar integralmente a **FlexLang v0.4.0**, criaremos um ecossistema real de **3 microsserviços integrados** em `examples/10_flexbank_distributed/`:

```
+---------------------+          HTTP Client (mTLS)          +--------------------------+
| flexbank-core       | -----------------------------------> | flexbank-pix-gateway     |
| - JWT Auth (RS256)  |                                      | - BACEN SPI Integration  |
| - Postgres + Redis  |                                      | - Circuit Breaker        |
| - Decimal Ledger    |                                      | - Idempotency Key Engine |
+---------------------+                                      +--------------------------+
          |                                                               |
          |                     Kafka / Event Stream                      |
          +---------------------------------------------------------------+
                                          |
                                          v
                              +--------------------------+
                              | flexbank-audit-notifier  |
                              | - Async Settle Consumer  |
                              | - Signed Audit Log (fs)  |
                              | - Prometheus Metrics     |
                              +--------------------------+
```

---

## 2. Cenários de Teste End-to-End (`tests/flexbank_distributed_integration.ts`)

1. **Setup**:
   - Inicializa os 3 microsserviços em portas efêmeras com arquivos `.env` carregados via `config/dotenv`.
2. **Fluxo de Transferência Pix com Resiliência**:
   - Cliente autenticado via JWT RS256 solicita transferência Pix via HTTP POST.
   - Core Banking valida DTO com `std/validator` e adquire lock atômico no Redis (`db/redis`).
   - `flexbank-core` invoca `flexbank-pix-gateway` via **Cliente HTTP Nativo (`net/http: Client`)** com W3C `traceparent` injetado.
   - Gateway executa chamada com **Circuit Breaker** e validação de `Idempotency-Key`.
   - Evento de liquidação é publicado e consumido assincronamente pelo serviço de auditoria.
   - Relatório de auditoria assinado em Base64 é persistido em disco com `std/fs`.
3. **Simulação de Instabilidade**:
   - Simula 5 quedas no BACEN SPI → valida abertura do Circuit Breaker e resposta imediata com fallback.
   - Reenvio da mesma requisição com o mesmo `Idempotency-Key` → valida que não houve débito duplo.

---

## 3. Critérios de Aceitação

- [ ] Os 3 microsserviços inicializam perfeitamente com `flex run` e compilam com `flex build`.
- [ ] O teste de integração automatizado executa 100% dos cenários com sucesso nos modos interpretado e Go nativo.
