# FlexBank Distributed Ecosystem (RFC-043)

Ecossistema distribuído corporativo de homologação da **FlexLang v0.4.0**, composto por 3 microsserviços integrados demonstrando resiliência, concorrência, idempotência, mensageria e telemetria:

---

## 1. Topologia dos Serviços

```
+---------------------+          HTTP Client (W3C trace)      +--------------------------+
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
                              | - Cron Scheduler Jobs    |
                              +--------------------------+
```

---

## 2. Como Executar

### Modo Interpretado (Desenvolvimento Rápido):
```bash
# Terminal 1: Iniciar FlexBank Core (:8081)
flex run examples/10_flexbank_distributed/flexbank-core/src/main.flex

# Terminal 2: Iniciar Pix Gateway (:8082)
flex run examples/10_flexbank_distributed/flexbank-pix-gateway/src/main.flex

# Terminal 3: Iniciar Audit Notifier (:8083)
flex run examples/10_flexbank_distributed/flexbank-audit-notifier/src/main.flex
```

### Modo Compilado (Go Nativo):
```bash
flex build examples/10_flexbank_distributed/flexbank-core/src/main.flex
flex build examples/10_flexbank_distributed/flexbank-pix-gateway/src/main.flex
flex build examples/10_flexbank_distributed/flexbank-audit-notifier/src/main.flex
```

---

## 3. Testes Automatizados de Integração

Execute toda a suíte de testes de integração com:
```bash
npm run test:flexbank-distributed
```
