# PRD — FlexLang v0.4.0 (Enterprise Banking & Distributed Ecosystem)

> **Status:** Draft · **Dono:** Arquitetura FlexLang & Comitê de Engenharia · **Última revisão:** agosto/2026
> **Versão anterior:** [`.docs/v0.3/`](../v0.3/) — Precisão Decimal, Closures, Métodos de Array/String, Time, Crypto, Env e FlexBank API monocore.

---

## 1. Visão Executiva e Motivação Estratégica

A **FlexLang v0.3.x** atingiu um marco histórico: entregou precisão monetária arbitrária com `math/decimal`, closures com escopo léxico, controle de fluxo moderno (`else if`, `for..in`, `catch`), criptografia com `bcrypt`/`uuid`/`hmac` e validou tudo com uma API bancária monolítica (`FlexBank API`).

No entanto, **a realidade de sistemas bancários de grande porte e alta escala (como Itaú, Nubank, Banco Central, Mercado Pago) não é composta por monólitos isolados**. Um ecossistema bancário maduro opera em uma **arquitetura distribuída de microsserviços de missão crítica**, onde:

1. **Comunicação Inter-serviços Segura**: O backend bancário conversa constantemente com parceiros externos e reguladores (ex: Sistema de Pagamentos Instantâneos - BACEN Pix SPI/DICT, antifraude, bureaus de crédito Serasa/Boa Vista, adquirentes e webhooks de parceiros). Sem um **Cliente HTTP nativo de alta performance com TLS/mTLS, connection pooling e timeouts granulares**, essa integração é impossível.
2. **Gestão Segura de Configurações por Ambiente**: Aplicações enterprise necessitam carregar variáveis e segredos a partir de arquivos `.env` estruturados (com suporte a interpolação, comentários e múltiplos perfis como `.env.local`, `.env.test`, `.env.production`), eliminando hardcoding e facilitando pipelines de CI/CD e containers Docker/Kubernetes.
3. **Serialização e Deserialização Universal (`JSON`, Base64, Hex)**: Sistemas de pagamento processam mensagens JSON complexas e assinaturas binárias codificadas em Base64/Hex para liquidação financeira e intercâmbio de dados bancários (ISO 20022).
4. **I/O e Manipulação de Certificados Digitais (`std/fs`, `std/path`)**: Bancos usam certificados digitais PEM/CRT (A1/A3, ICP-Brasil) para mTLS e assinaturas de transações bancárias, exigindo acesso nativo e seguro ao sistema de arquivos.
5. **Autenticação Descentralizada com Tokens JWT (`crypto/jwt`)**: Autenticação com chave assimétrica (RS256 com chave pública/privada) entre gateways de API e microsserviços bancários com controle rigoroso de expiração e claims.
6. **Armazenamento de Alta Velocidade e Locks Distribuídos (`db/redis`)**: Caching de saldos, controle de concorrência com locks atômicos (*distributed locking* para evitar *double spending* de contas) e rate limiting de transações por usuário.
7. **Resiliência e Tolerância a Falhas (`core/resilience`)**: Circuit breakers (estados Closed/Open/Half-Open), retries com backoff exponencial e jitter, e rate limiters nativos para proteger o core bancário contra colapso em momentos de pico de tráfego.
8. **Observabilidade e Tracing Distribuído (`core/telemetry`)**: Métricas Prometheus/OpenTelemetry nativas e propagação automática de W3C TraceContext (`traceparent`, `correlation_id`) através de todas as chamadas HTTP (cliente e servidor).
9. **Processamento Assíncrono e Mensageria Financeira (`mq/kafka`)**: Liquidação em lote, conciliação noturna de extratos e processamento assíncrono de notificações de pagamento via filas/tópicos de mensageria orientada a eventos.
10. **Idempotência Transacional Nativa (`finance/idempotency`)**: Garantia de que uma mesma transação financeira de pagamento nunca seja executada mais de uma vez, mesmo sob repetições de rede (*network retries*).

---

## 2. Diagnóstico de Lacunas Técnicas (Gap Analysis)

Análise executada na base de código atual (`src/*.ts`, `src/modules/*.ts`):

| # | Lacuna Técnica | Impacto no Backend Bancário | Evidência no Código | Prioridade |
|---|---|---|---|---|
| **L1** | **Sem Cliente HTTP Nativo** | Impossível conectar com BACEN Pix, bureaus de crédito, parceiros e outros microsserviços. | Inspecionado `src/modules/http.ts`: apenas `Server`, `Request`, `Response` existem. | **P0 (Solicitado)** |
| **L2** | **Sem Carregamento de Arquivo `.env`** | Toda configuração depende exclusivamente de variáveis globais do SO; impossível usar arquivos locais de ambiente. | `src/modules/env.ts`: apenas lê `process.env` / `os.Getenv`, sem parser de arquivo. | **P0 (Solicitado)** |
| **L3** | **Sem Módulo Universal de JSON / Encodings** | Falta `json.parse`, `json.stringify` programáticos livres e codificadores `base64`/`hex`. | JSON só é tratado implicitamente em `res.json()` e `req.json()`. | **P0** |
| **L4** | **Sem Acesso a Sistema de Arquivos (`std/fs`)** | Impossível ler certificados digitais (`.pem`, `.crt`), chaves privadas ou salvar relatórios de auditoria. | Não existe módulo `fs` ou `path` em `src/modules/registry.ts`. | **P0** |
| **L5** | **Sem Suporte a Tokens JWT com RS256/HS256** | Autenticação entre serviços distribuídos fica limitada a sessões no banco de dados. | `src/modules/crypto.ts`: possui bcrypt, HMAC e UUID, mas não possui RFC 7519 JWT. | **P0** |
| **L6** | **Sem Driver Nativo de Cache / Redis** | Sem cache de alto desempenho, locks atômicos anti-double-spending ou rate limiters rápidos. | Apenas `db/postgres` está implementado. | **P1** |
| **L7** | **Sem Mecanismos Nativos de Resiliência (Circuit Breaker)** | Falhas em APIs externas propagam em cascata e derrubam o servidor bancário. | Nenhuma primitiva de Circuit Breaker ou Rate Limiter existe na stdlib. | **P1** |
| **L8** | **Sem Tracing Distribuído / Métricas** | Sem observabilidade ponta a ponta entre serviços (W3C TraceContext, métricas Prometheus). | `core/log` gera logs locais em JSON, mas não possui métricas de histograma nem spans. | **P1** |
| **L9** | **Sem Mensageria Orientada a Eventos (Kafka)** | Impossível executar liquidações assíncronas e notificações financeiras com garantia at-least-once. | Inexistência de driver para message brokers. | **P1** |
| **L10** | **Sem Motor de Idempotência Padronizado** | Cada desenvolvedor precisa implementar tabelas e locks manuais de idempotência em SQL. | Falta de abstração padronizada de idempotency key. | **P1** |

---

## 3. Objetivo da Versão v0.4.0

> Capacitar a FlexLang para construir **ecossistemas bancários e financeiros distribuídos completos, escaláveis e resilientes**, com Cliente HTTP enterprise (mTLS, pooling, retries), suporte a `.env` com interpolação, serialização JSON/Base64/Hex, I/O de arquivos, JWT, Redis com locks distribuídos, Circuit Breakers, observabilidade com tracing W3C e motor de idempotência financeira — com 100% de paridade entre o interpretador e a compilação nativa Go.

### 3.1 Caso de Uso de Referência: "FlexBank Distributed Ecosystem"

O projeto de homologação da release v0.4.0 será uma **arquitetura distribuída de 3 microsserviços bancários integrados**:

1. **`flexbank-core` (Core Banking Service)**:
   - Gerenciamento de contas, saldos em `Decimal`, regras de crédito e livro-razão (*ledger*).
   - Servidor HTTP protegido por JWT (RS256) e banco Postgres.
   - Cache de saldos e controle de concorrência com Redis (*distributed locks*).
2. **`flexbank-pix-gateway` (BACEN Pix SPI Gateway)**:
   - Gateway de integração externa que utiliza o **Cliente HTTP Nativo** com mTLS para conectar ao mock do Banco Central.
   - Circuit Breaker nativo para isolar indisponibilidades do BACEN.
   - Motor de Idempotência (`Idempotency-Key`) para prevenir duplicidade de transferências Pix.
3. **`flexbank-audit-notifier` (Serviço de Auditoria e Eventos)**:
   - Processamento assíncrono de eventos de liquidação financeira.
   - Geração de relatórios de auditoria assinados gravados em disco (`std/fs`) com codificação Base64/Hex.
   - Propagação e coleta de W3C TraceContext entre todos os 3 serviços.

---

## 4. Estrutura de RFCs da Versão v0.4.0

```mermaid
graph TD
    subgraph Fase 1: Conectividade, I/O e Configurações Essenciais
        RFC31[RFC-031: Cliente HTTP Nativo]
        RFC32[RFC-032: Carregamento de Arquivos .env]
        RFC33[RFC-033: JSON & Encodings Base64/Hex]
        RFC34[RFC-034: Sistema de Arquivos std/fs e std/path]
        RFC35[RFC-035: Autenticação JWT com RS256/HS256]
    end

    subgraph Fase 2: Armazenamento Distribuído e Resiliência
        RFC36[RFC-036: Driver Nativo de Cache e Redis]
        RFC37[RFC-037: Validação Declarativa de Dados]
        RFC38[RFC-038: Resiliência: Circuit Breaker & Retries]
        RFC39[RFC-039: Telemetria, Métricas e Tracing W3C]
    end

    subgraph Fase 3: Mensageria, Agendamento e Idempotência
        RFC40[RFC-040: Mensageria de Eventos Financeiros]
        RFC41[RFC-041: Framework Nativo de Testes]
        RFC42[RFC-042: Motor de Idempotência Financeira]
        RFC44[RFC-044: Expressões Regulares Nativas]
        RFC45[RFC-045: Agendador de Background/Cron]
        RFC43[RFC-043: Validação FlexBank Distributed Ecosystem]
    end

    RFC31 --> RFC38
    RFC32 --> RFC31
    RFC33 --> RFC35
    RFC34 --> RFC35
    RFC35 --> RFC43
    RFC36 --> RFC42
    RFC38 --> RFC43
    RFC39 --> RFC43
    RFC40 --> RFC43
    RFC42 --> RFC43
```

---

## 5. Matriz Detalhada de Entregáveis

| RFC | Título | Prioridade | Escopo & Descrição |
|---|---|---|---|
| [RFC-031](rfcs/rfc-031-http-client.md) | **Cliente HTTP Nativo** | **P0 (Solicitado)** | Cliente HTTP assíncrono/síncrono com verbos (`get`, `post`, `put`, `delete`), connection pooling, timeouts granulares, certificados mTLS e retry automático com jitter. |
| [RFC-032](rfcs/rfc-032-dotenv-config.md) | **Carregador de Arquivos `.env`** | **P0 (Solicitado)** | Leitura de arquivos `.env` com suporte a comentários `#`, valores entre aspas, interpolação de variáveis `${VAR}`, multi-linhas e merge configurável com variáveis do SO. |
| [RFC-033](rfcs/rfc-033-json-and-encoding.md) | **JSON Universal & Encodings (Base64/Hex)** | **P0** | `json.parse`, `json.stringify`, e módulos `encoding/base64` e `encoding/hex` para manipulação de payloads binários e intercâmbio bancário. |
| [RFC-034](rfcs/rfc-034-filesystem-and-paths.md) | **Sistema de Arquivos (`std/fs`, `std/path`)** | **P0** | Leitura/escrita de arquivos, manipulação de diretórios e paths para leitura de certificados digitais e relatórios. |
| [RFC-035](rfcs/rfc-035-jwt-and-security.md) | **Autenticação JWT (`crypto/jwt`)** | **P0** | Geração e validação de tokens JWT com algoritmos HMAC (HS256) e RSA Assimétrico (RS256) com chaves públicas/privadas. |
| [RFC-036](rfcs/rfc-036-redis-native-driver.md) | **Driver Nativo de Cache (`db/redis`)** | P1 | Conexão poolada com Redis, operações chave-valor com TTL, e locks atômicos distribuídos (*Redlock/SET NX EX*). |
| [RFC-037](rfcs/rfc-037-data-validation.md) | **Validação de Dados (`std/validator`)** | P1 | Validação de CPF/CNPJ, e-mail, ranges monetários, schemas de DTOs de request com retorno estruturado de erros amigáveis. |
| [RFC-038](rfcs/rfc-038-resilience-circuit-breaker.md) | **Resiliência e Tolerância a Falhas (`core/resilience`)** | P1 | Implementação de Circuit Breaker (estados Closed/Open/Half-Open), Rate Limiting (Token Bucket) e Exponential Backoff. |
| [RFC-039](rfcs/rfc-039-telemetry-and-metrics.md) | **Métricas e Tracing Distribuído (`core/telemetry`)** | P1 | Exportação de métricas Prometheus (/metrics), contadores, histogramas de latência e injeção/extração de headers W3C `traceparent`. |
| [RFC-040](rfcs/rfc-040-event-messaging-kafka.md) | **Mensageria de Eventos Financeiros (`mq/events`)** | P1 | Abstração e driver para filas/tópicos de mensageria com garantia de entrega e consumo desacoplado. |
| [RFC-041](rfcs/rfc-041-native-testing-framework.md) | **Framework Nativo de Testes (`std/testing`)** | P0 | O comando `flex test`, atributos `#[test]` e assertivas para permitir que usuários testem suas próprias APIs de forma idêntica ao Go/Rust. |
| [RFC-042](rfcs/rfc-042-idempotency-engine.md) | **Motor de Idempotência Financeira (`finance/idempotency`)** | P1 | Middleware e serviço para controle automático de requisições duplicadas via chave de idempotência e locks atômicos. |
| [RFC-044](rfcs/rfc-044-regex-engine.md) | **Expressões Regulares Nativas (`std/regex`)** | P1 | Compilação e execução de regex paritária (O(n) - sem ReDoS) para busca e substituição em strings e validações complexas. |
| [RFC-045](rfcs/rfc-045-cron-scheduler.md) | **Agendador de Background (`core/scheduler`)** | P1 | Execução concorrente de rotinas agendadas (Cron) sem bloquear o Event Loop principal. |
| [RFC-043](rfcs/rfc-043-flexbank-distributed-validation.md) | **Projeto de Validação Distribuído E2E** | P1 | Suíte de integração com 3 microsserviços reais se comunicando via HTTP Client, Redis, Postgres e JWT. |

---

## 6. Critérios de Sucesso e Definição de Pronto (DoD)

1. **Paridade Absoluta (100%)**: Todo código utilizando o Cliente HTTP, Dotenv, JSON, JWT, Redis e Resiliência deve funcionar com o mesmo resultado exato no interpretador TypeScript e no binário compilado em Go.
2. **Desempenho Sob Carga**: O Cliente HTTP compilado em Go deve suportar 50.000 requisições/segundo com connection pooling e keep-alive ativados.
3. **Resiliência Bancária**: Circuit Breaker deve abrir automaticamente ao atingir a taxa de erro configurada e recuperar graciosamente sem panics no processo.
4. **Segurança de Nível Financeiro**: Nenhum token JWT forjado ou expirado deve passar na validação; variáveis sensíveis do `.env` devem ser protegidas e mascaradas em logs.
5. **Zero Regressão**: Toda a suíte de testes legados (35 golden tests + integrações HTTP/Postgres/Watch/FlexBank v0.3) continua 100% verde.
