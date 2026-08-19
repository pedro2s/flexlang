# FlexLang v0.4.0 — Especificações de Ecossistema Distribuído & Banking

Conjunto completo de especificações técnicas da **quarta release pública da FlexLang**. A v0.3.0 consolidou a linguagem para APIs bancárias monocore; a **v0.4.0 a escala para arquiteturas de microsserviços distribuídos de missão crítica**, com Cliente HTTP nativo (mTLS/pooling), carregamento de arquivos `.env` estilo dotenv, serialização JSON e Base64/Hex universais, I/O em disco para certificados, autenticação JWT (RS256/HS256), driver Redis com locks distribuídos, circuit breakers, métricas Prometheus/Tracing W3C, mensageria e motor de idempotência financeira.

---

## 📚 Documentos Centrais

- **[`prd.md`](prd.md)** — **Comece aqui**: Diagnóstico do estado atual, lacunas de ecossistema distribuído, caso de uso de referência (*FlexBank Distributed Ecosystem*), escopo incluído e critérios de sucesso.
- **[`architecture_overview.md`](architecture_overview.md)** — Topologia do compilador, pipeline de execução, novos tipos internos, integração de módulos nativos e paridade TS/Go.
- **[`test_plan.md`](test_plan.md)** — Matriz de testes por camada (Golden-file, Parity Gate, Resiliência, Segurança e E2E Distribuído).
- **[`release_plan.md`](release_plan.md)** — Milestones, cronograma de implementação, matriz de riscos técnicos e Definition of Done (DoD).
- **[`rfcs/`](rfcs/)** — Especificações técnicas detalhadas por funcionalidade.

---

## 📑 Índice de RFCs (031 a 043)

### Fase 1 — Conectividade, I/O e Configurações Essenciais

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-031](rfcs/rfc-031-http-client.md) | **Cliente HTTP Nativo** | **P0 (Solicitado)** | Cliente HTTP assíncrono/síncrono com verbos, connection pooling, mTLS e timeouts |
| [RFC-032](rfcs/rfc-032-dotenv-config.md) | **Carregamento de `.env` (`config/dotenv`)** | **P0 (Solicitado)** | Parser `.env` com comentários, aspas, interpolação `${VAR}` e merge seguro |
| [RFC-033](rfcs/rfc-033-json-and-encoding.md) | **JSON Universal & Encodings (Base64/Hex)** | **P0** | `json.parse`, `json.stringify`, `encoding/base64` e `encoding/hex` |
| [RFC-034](rfcs/rfc-034-filesystem-and-paths.md) | **Sistema de Arquivos (`std/fs`, `std/path`)** | **P0** | Leitura/escrita de arquivos, manipulação de diretórios e leitura de certificados |
| [RFC-035](rfcs/rfc-035-jwt-and-security.md) | **Autenticação JWT (`crypto/jwt`)** | **P0** | Emissão e validação de tokens com algoritmos HS256 e RSA Assimétrico (RS256) |

### Fase 2 — Armazenamento Distribuído e Validação

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-036](rfcs/rfc-036-redis-native-driver.md) | **Driver Nativo de Cache (`db/redis`)** | P1 | Conexão poolada com Redis, caching com TTL e locks distribuídos atômicos |
| [RFC-037](rfcs/rfc-037-data-validation.md) | **Validação de Dados (`std/validator`)** | P1 | Validação de CPF/CNPJ, e-mail, ranges e schemas declarativos de DTOs |

### Fase 3 — Automação, Resiliência e Observabilidade

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-038](rfcs/rfc-038-resilience-circuit-breaker.md) | **Resiliência: Circuit Breakers & Retries** | P1 | Circuit Breaker (Closed/Open/Half-Open), Rate Limiter e Exponential Backoff |
| [RFC-039](rfcs/rfc-039-telemetry-and-metrics.md) | **Métricas e Tracing Distribuído** | P1 | Métricas Prometheus (/metrics), histogramas de latência e cabeçalhos W3C |
| [RFC-041](rfcs/rfc-041-native-testing-framework.md) | **Framework Nativo de Testes (`std/testing`)** | P0 | O comando `flex test` e assertivas unificadas |
| [RFC-044](rfcs/rfc-044-regex-engine.md) | **Expressões Regulares Nativas (`std/regex`)** | P1 | Motor RE2 protegido contra ReDoS e alta performance em manipulação textual |
| [RFC-045](rfcs/rfc-045-cron-scheduler.md) | **Agendador de Background (`core/scheduler`)** | P1 | Execução concorrente de rotinas via sintaxe Cron e intervalos sem travar o Event Loop |

### Fase 4 — Mensageria e Homologação E2E

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-040](rfcs/rfc-040-event-messaging-kafka.md) | **Mensageria de Eventos Financeiros** | P1 | Abstração e drivers de mensageria com garantia de entrega e consumo em lote |
| [RFC-042](rfcs/rfc-042-idempotency-engine.md) | **Motor de Idempotência Financeira** | P1 | Middleware e serviço de idempotency key contra double-spending e retries |
| [RFC-043](rfcs/rfc-043-flexbank-distributed-validation.md) | **Projeto de Homologação E2E** | P1 | 3 microsserviços integrados (Core + Pix SPI Gateway + Audit Notifier) |

---

## 🎯 Caso de Uso de Referência: FlexBank Distributed Ecosystem

O projeto de homologação da v0.4.0 (`examples/10_flexbank_distributed`) valida:
1. **Core Banking (`flexbank-core`)**: Protegido por JWT RS256, Postgres e cache/locks no Redis.
2. **Pix Gateway (`flexbank-pix-gateway`)**: Conecta ao BACEN via **Cliente HTTP com mTLS**, protegido por **Circuit Breaker** e motor de **Idempotência**.
3. **Audit Notifier (`flexbank-audit-notifier`)**: Consome eventos de liquidação assíncrona, gera relatórios em disco via `std/fs` e exporta métricas Prometheus.
