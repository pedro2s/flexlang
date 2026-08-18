# RFC-024 — Declarações `const` de Nível de Módulo

> **Status:** Proposto · **Prioridade:** P1 · **Depende de:** nada

## 1. Motivação

Não há como declarar constantes. `let TAX_RATE = 0.15;` no top-level vira `var TAX_RATE = 0.15` no Go (mutável em runtime). Constantes de configuração, códigos de erro, limites e taxas fixas devem ser garantidamente imutáveis.

## 2. Design

```flexlang
const MAX_RETRIES = 3;
const TAX_RATE = 0.15;
const BANK_NAME = "FlexBank S.A.";
const DEFAULT_CURRENCY = "BRL";
```

### 2.1 Regras

1. `const` só aceita literais (numéricos, strings, booleans) — sem chamadas de função.
2. `const` é sempre de nível de módulo (top-level) — não dentro de funções.
3. `const` não pode ser reatribuída — erro `E3003` "Cannot assign to constant".
4. Tipo é inferido do literal.

### 2.2 Transpilação Go

```go
const MAX_RETRIES = 3
const TAX_RATE = 0.15
const BANK_NAME = "FlexBank S.A."
```

## 3. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/ast.ts` | Novo nó `ConstDeclaration` |
| `src/lexer.ts` | Novo token `Const` |
| `src/parser.ts` | Parser de `const name = literal;` |
| `src/checker.ts` | Validação: só literais, erro `E3003` em reatribuição |
| `src/interpreter.ts` | Define como variável imutável no Environment |
| `src/transpiler.ts` | Emite `const` no Go |

## 4. Plano de Testes

- Golden test: `const` com Int, Float, String, Bool
- Golden test: reatribuição de `const` → erro `E3003`
- Golden test: `const` com chamada de função → erro de parsing
- Parity test: paridade completa
