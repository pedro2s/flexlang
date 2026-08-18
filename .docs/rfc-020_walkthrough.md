# Walkthrough: Implementação da RFC-020 — Métodos de Array

Implementamos com sucesso a especificação [RFC-020](file:///home/pedro/dev/pedro/flexlang/.docs/v0.3/rfcs/rfc-020-array-methods.md) na linguagem FlexLang, introduzindo uma API de manipulação e iteração funcional para coleções do tipo `[T]` (Array).

---

## 🛠️ Métodos Implementados

### 1. Métodos Imutáveis
| Método | Assinatura | Retorno | Mapeamento Go |
|---|---|---|---|
| `len` | `arr.len()` | `Int` | `len(arr)` |
| `is_empty` | `arr.is_empty()` | `Bool` | `(len(arr) == 0)` |
| `contains` | `arr.contains(item: T)` | `Bool` | Loop inline com comparação de igualdade |
| `slice` | `arr.slice(start: Int, end: Int)` | `[T]` | `arr[start:end]` |
| `concat` | `arr.concat(other: [T])` | `[T]` | `append(append([]T{}, arr...), other...)` |
| `map` | `arr.map(transform: \|T\| -> U)` | `[U]` | Loop gerador com append tipado |
| `filter` | `arr.filter(predicate: \|T\| -> Bool)` | `[T]` | Loop condicional de filtragem |
| `find` | `arr.find(predicate: \|T\| -> Bool)` | `Option<T>` | Loop com early return `Option.Some` / `Option.None` |
| `for_each` | `arr.for_each(action: \|T\| -> Void)` | `Void` | Loop IIFE de execução |

### 2. Métodos Mutáveis (Exigem `mut`)
| Método | Assinatura | Retorno | Mapeamento Go |
|---|---|---|---|
| `push` | `arr.push(item: T)` | `Void` | `arr = append(arr, item)` |
| `pop` | `arr.pop()` | `Option<T>` | Remoção in-place com retorno `Option.Some` / `Option.None` |
| `sort` | `arr.sort()` | `Void` | `sort.Slice(arr, ...)` |

---

## 🔧 Alterações por Componente

1. **Parser ([`src/parser.ts`](file:///home/pedro/dev/pedro/flexlang/src/parser.ts))**:
   - Parâmetros de `parseLambdaExpr` tornados flexíveis com anotação de tipo opcional (`|x| { ... }` ou `|x: Int| { ... }`).

2. **Type Checker ([`src/checker.ts`](file:///home/pedro/dev/pedro/flexlang/src/checker.ts))**:
   - Validação estática de mutabilidade (`E3001`) ao chamar `push`, `pop` ou `sort` em identificadores imutáveis.
   - Inferência contextual do tipo de parâmetro e retorno para closures de alta ordem (`map`, `filter`, `find`, `for_each`).
   - Verificação estática de tipos de argumentos e aridades (`E2012`).

3. **Interpretador ([`src/interpreter.ts`](file:///home/pedro/dev/pedro/flexlang/src/interpreter.ts))**:
   - Execução nativa de todos os 12 métodos sobre arrays JS.
   - Integração das closures com `this.callFunction(fn, [item])`.
   - Suporte a `Option.Some` e `Option.None` em `pop` e `find`.

4. **Transpiler Go ([`src/transpiler.ts`](file:///home/pedro/dev/pedro/flexlang/src/transpiler.ts))**:
   - Emissão de código Go idiomático para slices, closures e funções de ordem superior.
   - Importação automática de `sort` e emissão do boilerplate de `Option`.

---

## 🧪 Testes e Validação

### Resultados dos Testes:
1. **Novo Teste Golden [`tests/39_array_methods.flex`](file:///home/pedro/dev/pedro/flexlang/tests/39_array_methods.flex)**:
   - Validação dos 12 métodos funcionais e mutáveis.
2. **Suíte Golden Completa**:
   ```bash
   $ npm test
   Tests Completed: 39 passed, 0 failed.
   ```
3. **Paridade Node ↔ Go**:
   ```bash
   $ npm run test:parity
   Parity gate: 34 passaram, 0 falharam, 5 sem comparação de stdout.
   ```
4. **Testes da Extensão VSCode**:
   ```bash
   $ npm run test:vscode
   ✅ Sucesso: RFC-020: métodos de Array (len, is_empty, contains, slice, concat, push, sort, pop, map, filter, find, for_each) validados
   ✅ Sucesso: RFC-020: push em array imutável emite erro estático E3001
   ✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!
   ```
