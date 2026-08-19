# Plano de Testes — FlexLang v0.4.0 (Enterprise Banking & Distributed Ecosystem)

> **Status:** Draft · **Dono:** Qualidade e Engenharia de Compiladores · **Última revisão:** agosto/2026
> **Relacionado:** [PRD](prd.md), [Release Plan](release_plan.md), RFCs 031 a 043 em [`rfcs/`](rfcs/)

---

## 1. Estratégia de Testes

Para garantir a confiabilidade exigida por sistemas financeiros, a **v0.4.0** adiciona suites de testes dedicadas para conectividade externa, concorrência distribuída e segurança criptográfica.

---

## 2. Matriz de Testes por Camada

| Camada de Teste | Arquivo de Teste | Funcionalidades Validadas |
|---|---|---|
| **Golden-File Unitários** | `tests/53_http_client.flex` | Requisições GET/POST/PUT/DELETE, headers, query params e timeouts |
| | `tests/54_dotenv_loading.flex` | Parsing de `.env`, interpolação `${VAR}`, comentários e aspas |
| | `tests/55_json_encodings.flex` | `json.parse`, `json.stringify`, `base64` e `hex` |
| | `tests/56_filesystem_io.flex` | Leitura/escrita de arquivos, `exists`, manipulação de paths |
| | `tests/57_jwt_auth.flex` | Emissão e verificação de JWT com HS256 e RS256 |
| | `tests/58_redis_cache_lock.flex` | `set_ex`, `get`, `del`, contadores atômicos e locks distribuídos |
| | `tests/59_data_validation.flex` | Validação de CPF/CNPJ, email e DTOs estruturados |
| | `tests/60_circuit_breaker.flex` | Estados `CLOSED` -> `OPEN` -> `HALF_OPEN` e rate limiting |
| | `tests/61_telemetry_metrics.flex` | Exportação Prometheus e W3C `traceparent` |
| | `tests/62_testing_framework.flex` | Asserções e framework de teste (`std/testing`) |
| | `tests/63_regex_engine.flex` | Compilação RE2, match e replace_all |
| | `tests/64_scheduler_cron.flex` | Agendamento via sintaxe cron e intervalos |
| **Parity Gate (TS vs Go)** | `npm run test:parity` | 100% de conformidade de saída entre interpretador e Go nativo |
| **Testes de Resiliência** | `tests/resilience_stress.ts` | 10.000 requisições concorrentes com Circuit Breaker e retries |
| **Testes de Segurança** | `tests/jwt_security_fuzz.ts` | Rejeição de tokens expirados, alteração de payload e chave inválida |
| **Validação Distribuída E2E** | `tests/flexbank_distributed_integration.ts` | 3 microsserviços integrados (Core + Pix SPI Gateway + Audit Notifier) |

---

## 3. Critérios de Aceitação da Release

- [ ] 100% de aprovação na suite de 62+ golden tests.
- [ ] Parity Gate verde em todos os módulos novos.
- [ ] Teste de integração do ecossistema distribuído bancário passando em < 10s.
- [ ] Zero vazamento de conexões ou file descriptors em testes de estresse.
