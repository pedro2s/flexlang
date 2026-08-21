---
title: Enterprise Microservices — FlexBank Distributed Ecosystem
description: Distributed architecture with 3 microservices integrating JWT, Idempotency, Event Streams, W3C Spans, and Auditing.
---

The **FlexBank Distributed Ecosystem** reference project demonstrates a complete enterprise architecture in FlexLang composed of 3 microservices communicating via synchronous HTTP and asynchronous Event Messaging.

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

## 🚀 Running the Ecosystem

```bash
# Run end-to-end integration tests (both interpreted and compiled native Go)
npm run test:flexbank-distributed
```
