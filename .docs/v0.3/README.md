# FlexLang v0.3.0 — Especificações de Nível Enterprise

Conjunto de especificações da terceira release pública da FlexLang. A v0.2.0 tornou a linguagem capaz de expressar APIs REST completas; a v0.3.0 a escala para **backends enterprise de nível financeiro**, com aritmética decimal precisa, manipulação rica de strings e arrays, closures, iteração sobre coleções, módulos de tempo/crypto/env, controle de fluxo maduro e tratamento avançado de erros.

---

## 📚 Documentos Centrais

- **[`prd.md`](prd.md)** — **Comece aqui**: Diagnóstico do estado atual com evidências na base de código, lacunas identificadas, caso de uso de referência (backend de banco digital FlexBank), escopo incluído e excluído.
- **[`architecture_overview.md`](architecture_overview.md)** — Topologia do compilador, pipeline de execução, novos tipos internos, integração de módulos nativos e paridade TS/Go.
- **[`test_plan.md`](test_plan.md)** — A matriz de testes de 7 camadas (Golden-file, Parity Gate, Decimal Precision, Diagnósticos Negativos, Criptografia, Integração e E2E).
- **[`release_plan.md`](release_plan.md)** — Milestones, cronograma de implementação, matriz de riscos técnicos e Definition of Done (DoD).
- **[`rfcs/`](rfcs/)** — Especificações técnicas detalhadas por funcionalidade.

---

## 📑 Índice de RFCs

### Fase 1 — Linguagem Core e Expressividade

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-017](rfcs/rfc-017-else-if-and-control-flow.md) | `else if`, `break`, `continue` | **P0** | Eliminação de pirâmides condicionais e controle de loops |
| [RFC-018](rfcs/rfc-018-for-in-collections.md) | `for item in collection` | **P0** | Iteração sobre Arrays, Maps e Ranges com índice opcional |
| [RFC-019](rfcs/rfc-019-string-methods.md) | Métodos de `String` | **P0** | 11 métodos imutáveis (`len`, `split`, `trim`, `replace`, etc.) |
| [RFC-020](rfcs/rfc-020-array-methods.md) | Métodos de `Array` | **P0** | Métodos imutáveis e mutáveis com validação estática de `mut` |
| [RFC-021](rfcs/rfc-021-closures.md) | Closures com Captura de Escopo | **P0** | Funções de alta ordem (`map`, `filter`, `find`) com captura léxica |
| [RFC-022](rfcs/rfc-022-type-conversions.md) | Conversões de Tipo | **P0** | `to_string()`, `parse_int()` e `parse_float()` retornando `Result` |
| [RFC-023](rfcs/rfc-023-hashmap.md) | `HashMap<K, V>` Tipado | P1 | Tabela hash com chave/valor tipados para caches e lookups |
| [RFC-024](rfcs/rfc-024-const-declarations.md) | Declarações `const` | P1 | Constantes top-level com garantia de imutabilidade |

### Fase 2 — Módulos Nativos da Stdlib

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-025](rfcs/rfc-025-decimal-module.md) | Módulo `math/decimal` | **P0** | Aritmética monetária de precisão arbitrária e juros compostos |
| [RFC-026](rfcs/rfc-026-env-module.md) | Módulo `os/env` | **P0** | Variáveis de ambiente com leitura segura (`get`, `require`) |
| [RFC-027](rfcs/rfc-027-time-module.md) | Módulo `core/time` | **P0** | Timestamps UTC, durações e prazos de expiração |
| [RFC-028](rfcs/rfc-028-crypto-module.md) | Módulo `crypto` | P1 | Hashing com bcrypt, geração de UUID v4 e HMAC-SHA256 |

### Fase 3 — Tratamento de Erros e Validação End-to-End

| RFC | Título | Prioridade | Descrição |
|---|---|---|---|
| [RFC-029](rfcs/rfc-029-enhanced-error-handling.md) | `catch` Blocks | P1 | Interceptação elegante de `Result.Err` para retries e fallbacks |
| [RFC-030](rfcs/rfc-030-project-validation.md) | Projeto FlexBank API | P1 | Backend bancário completo validando 100% dos recursos |

---

## 🎯 Caso de Uso de Referência: FlexBank API

O projeto de validação da v0.3.0 será o **FlexBank API** (`examples/09_flexbank_api`), demonstrando:
- Cadastro com validação de CPF e hashing de senha via bcrypt.
- Contas bancárias com saldos em `Decimal`.
- Transferências ACID atômicas com rollback em caso de falha.
- Extrato com paginação e ordenação via métodos de array.
- Simulação de investimentos e cálculo de juros compostos precisos.
- Autenticação por token com timestamps de expiração via `Time`.
- Observabilidade completa com correlation IDs e mascaramento em logs.
