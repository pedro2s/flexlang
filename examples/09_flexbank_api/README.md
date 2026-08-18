# 🏦 FlexBank API — Projeto de Referência FlexLang v0.3.0

O **FlexBank API** é uma API REST corporativa de serviços financeiros construída com a linguagem **FlexLang**, exercitando e comprovando a robustez de todas as especificações introduzidas na versão **v0.3.0**.

---

## 🌟 Recursos Exercitados

| RFC | Recurso | Aplicação no FlexBank |
|---|---|---|
| **RFC-011 / 015** | HTTP Server & CORS & Middlewares | Servidor REST com `GET`, `POST`, `PUT`, `DELETE`, headers de correlation ID e CORS |
| **RFC-017** | `else if`, `break`, `continue` | Validações e controle de fluxo nas rotas e regras de negócio |
| **RFC-018** | `for..in` em coleções | Iteração sobre listas de transações e contas |
| **RFC-019** | Métodos de `String` | `substring`, `trim`, formatação de identificadores |
| **RFC-020** | Métodos de `Array` | `len`, `map`, `filter`, `push` no extrato de transações |
| **RFC-021** | Closures com Captura | Predicados `filter(\|t\| ...)` e `map(\|tx\| ...)` |
| **RFC-022** | Conversões de Tipo | `parse_int` e `to_string` para parâmetros de requisição |
| **RFC-023** | `HashMap` Tipado | Armazenamento de contas, usuários e sessões ativas |
| **RFC-024** | Declarações `const` | Constantes de portas e limites de retry |
| **RFC-025** | Módulo `math/decimal` | Precisão arbitrária em saldos, transferências e juros compostos (`pow`, `round`) |
| **RFC-026** | Módulo `os/env` | Leitura de variáveis de ambiente (`FLEXBANK_PORT`, `FLEXBANK_ENV`) |
| **RFC-027** | Módulo `core/time` | Geração de timestamps ISO 8601 e cálculo de expiração com `Duration` |
| **RFC-028** | Módulo `crypto` | Hashing seguro com `bcrypt`, validação `bcrypt_verify` e identificadores `uuid.v4` |
| **RFC-029** | `catch` Blocks | Fallbacks inline e tratamento ergonômico de variantes `Result.Err` |

---

## 🚀 Como Executar

### 1. Modo Interpretado (Node.js)
```bash
npx flex run examples/09_flexbank_api/src/main.flex
```

### 2. Modo Compilado (Go)
```bash
npx flex build examples/09_flexbank_api/src/main.flex -o flexbank
./flexbank
```

---

## 📡 Endpoints Disponíveis

- **Autenticação**:
  - `POST /auth/register`: Cadastro com hash bcrypt de senha e criação de conta.
  - `POST /auth/login`: Login com verificação bcrypt e emissão de token UUID com expiração `Time`.
- **Gestão de Contas**:
  - `GET /accounts/:id`: Consulta de dados cadastrais e saldo.
  - `GET /accounts/:id/balance`: Consulta exclusiva de saldo Decimal.
  - `PUT /accounts/:id`: Atualização de titular e email.
  - `DELETE /accounts/:id`: Encerramento de conta (`CLOSED`).
- **Transações e Investimentos**:
  - `POST /transfers`: Transferência entre contas com validação de saldo Decimal e `catch`.
  - `POST /investments/simulate`: Simulação de juros compostos $M = P \cdot (1 + i)^n$ com `Decimal.pow`.
  - `GET /accounts/:id/statement`: Extrato de transações gerado com `filter` e `map`.
- **Infraestrutura**:
  - `GET /healthz`: Health check nativo da FlexLang.
