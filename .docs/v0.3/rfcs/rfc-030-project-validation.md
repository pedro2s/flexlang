# RFC-030 — Projeto de Referência FlexBank API e Validação End-to-End

> **Status:** Implementado · **Prioridade:** P1 · **Depende de:** Todas as RFCs 017-029

## 1. Motivação

A v0.2.0 foi validada pelo projeto `Le Salvi API` (salão de beleza). A v0.3.0 precisa de um projeto mais exigente que comprove que a FlexLang está pronta para backends financeiros enterprise. O **FlexBank API** é esse projeto.

## 2. Escopo do FlexBank API

### 2.1 Domínio de Negócio

O FlexBank é um banco digital simplificado que implementa:

1. **Gestão de Contas**: Cadastro, consulta, atualização e encerramento.
2. **Saldo e Extrato**: Consulta de saldo em `Decimal`, extrato paginado cursor-based.
3. **Transferências**: TED/Pix entre contas com validação, transações ACID e auditoria.
4. **Cálculo de Juros**: Juros compostos sobre investimentos com `Decimal`.
5. **Autenticação**: Login com bcrypt, geração de token com UUID, expiração com `Time`.
6. **Configuração**: Variáveis de ambiente para credenciais e feature flags.
7. **Observabilidade**: Logs estruturados com correlation ID, timestamps, mascaramento de senhas.

### 2.2 Recursos FlexLang Exercitados

| Recurso | Onde é usado |
|---|---|
| `Decimal` (RFC-025) | Saldo, transferências, juros, split de pagamento |
| `String` methods (RFC-019) | Validação de CPF, formatação de moeda, normalização de email |
| `Array` methods (RFC-020) | Filtragem de transações, mapeamento para extrato, paginação |
| Closures (RFC-021) | Predicados de `filter`/`map`/`find` |
| `for item in collection` (RFC-018) | Iteração sobre transações, contas, registros |
| `else if` (RFC-017) | Despacho de status, validação condicional |
| `HashMap` (RFC-023) | Cache de taxas, lookup de contas por ID |
| `const` (RFC-024) | Constantes de configuração (`MAX_RETRIES`, `BCRYPT_COST`) |
| `env` (RFC-026) | `DATABASE_URL`, `JWT_SECRET`, `PORT` |
| `Time` (RFC-027) | Timestamps de auditoria, expiração de tokens, cálculo de prazos |
| `crypto` (RFC-028) | bcrypt para senhas, UUID para transações, HMAC para webhooks |
| `catch` (RFC-029) | Retry em integrações externas, fallback de cache |
| Conversões (RFC-022) | `to_string`, `parse_int` em parâmetros e respostas |
| CORS (RFC-015) | Frontend web do banco |
| Middlewares (RFC-015) | Auth, logging, correlation ID |
| Verbos HTTP (RFC-011) | CRUD completo de contas e transações |
| Traits | Interface `Auditable` implementada por todas as entidades |
| `db/postgres` | Persistência de todas as entidades |
| `core/log` | Auditoria com mascaramento de dados sensíveis |

### 2.3 Estrutura do Projeto

```text
examples/09_flexbank_api/
├── flex.toml
├── README.md
└── src/
    ├── config/
    │   └── settings.flex           # Constantes e env vars
    ├── models/
    │   ├── account.flex            # Struct Account, enums AccountStatus/AccountType
    │   ├── transaction.flex        # Struct Transaction, enum TransactionType
    │   └── auth.flex               # Struct Credentials, AuthToken
    ├── services/
    │   ├── account_service.flex    # Lógica de negócio de contas
    │   ├── transfer_service.flex   # Transferências ACID com Decimal
    │   ├── interest_service.flex   # Cálculo de juros compostos
    │   └── audit_service.flex      # Auditoria com timestamps
    ├── middlewares/
    │   ├── auth_middleware.flex    # Verificação de token
    │   ├── correlation.flex       # Geração e propagação de correlation ID
    │   └── rate_limiter.flex      # Rate limiting simples com HashMap
    ├── routes/
    │   ├── auth_routes.flex       # POST /auth/login, /auth/register
    │   ├── account_routes.flex    # CRUD de contas
    │   ├── transfer_routes.flex   # POST /transfers
    │   └── statement_routes.flex  # GET /accounts/:id/statement
    ├── traits/
    │   └── auditable.flex         # trait Auditable
    └── main.flex                  # Bootstrap com CORS, middlewares e rotas
```

### 2.4 Endpoints

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cadastro com validação de CPF e bcrypt |
| `POST` | `/auth/login` | Login com verificação de senha |
| `GET` | `/accounts/:id` | Consulta de conta com saldo Decimal |
| `PUT` | `/accounts/:id` | Atualização de dados cadastrais |
| `DELETE` | `/accounts/:id` | Encerramento de conta |
| `POST` | `/transfers` | Transferência entre contas (ACID) |
| `GET` | `/accounts/:id/statement` | Extrato paginado cursor-based |
| `GET` | `/accounts/:id/balance` | Saldo atual em Decimal |
| `POST` | `/investments/simulate` | Simulação de juros compostos |

## 3. Validação

### 3.1 Smoke Test Automatizado

Criar `tests/flexbank_integration.ts` que:
1. Inicia o FlexBank API em modo interpretado e compilado
2. Executa requests HTTP reais contra cada endpoint
3. Valida respostas, status codes, headers
4. Verifica integridade de operações Decimal (soma de débitos + créditos = 0)
5. Verifica que `0.1 + 0.2 = 0.3` em contexto de transferência

### 3.2 Checklist de Aceitação

- [x] Projeto compila com `flex build` sem erros
- [x] Projeto roda com `flex run` e `flex run --watch`
- [x] Todos os endpoints respondem corretamente
- [x] Operações com Decimal produzem resultados precisos
- [x] Senhas são hasheadas com bcrypt
- [x] Tokens têm UUID e expiração
- [x] Logs contêm correlation ID e timestamps
- [x] Dados sensíveis são mascarados nos logs
- [x] Health check `/healthz` responde 200
- [x] CORS configurado para frontend
