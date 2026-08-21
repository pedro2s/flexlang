---
title: Microsserviços Enterprise — FlexBank Distributed Ecosystem
description: Arquitetura distribuída com 3 microsserviços integrando JWT, Idempotência, Event Streams, Spans W3C e Auditoria.
---

O projeto de referência **FlexBank Distributed Ecosystem** demonstra a construção de uma arquitetura enterprise completa em FlexLang composta por 3 microsserviços comunicando-se via HTTP síncrono e Mensageria de Eventos assíncrona.

```
+---------------------+          HTTP Client (mTLS)          +--------------------------+
| flexbank-core       | -----------------------------------> | flexbank-pix-gateway     |
| - JWT Auth (RS256)  |                                      | - BACEN SPI Integration  |
| - Regex Validation  |                                      | - Circuit Breaker        |
| - Decimal Ledger    |                                      | - Idempotency Key Engine |
| - OpenTelemetry     |                                      | - Counter Metrics        |
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
                              | - Cron Reconciliation    |
                              +--------------------------+
```

---

## 🏛️ 1. Os Microsserviços

### 1. `flexbank-core` (Porta 8081)
- **Papel:** Core banking, autenticação de clientes e emissão de eventos.
- **Módulos:** `crypto/jwt`, `std/regex`, `math/decimal`, `core/telemetry`, `mq/kafka`.

### 2. `flexbank-pix-gateway` (Porta 8082)
- **Papel:** Integração com o BACEN SPI protegida contra indisponibilidade e duplicidade de requisições.
- **Módulos:** `finance/idempotency`, `core/resilience`, `core/telemetry`.

### 3. `flexbank-audit-notifier` (Porta 8083)
- **Papel:** Ingestão de eventos de liquidação, assinatura digital SHA-256/Base64 para auditoria, métricas Prometheus e fechamento contábil diário via cron.
- **Módulos:** `mq/kafka`, `crypto`, `encoding/base64`, `std/fs`, `core/scheduler`, `core/telemetry`.

---

## 🚀 2. Executando o Ecossistema

Você pode rodar todo o ecossistema distribuído com:

```bash
# Executa a suíte completa de testes de integração end-to-end (interpretado e compilado Go)
npm run test:flexbank-distributed
```
