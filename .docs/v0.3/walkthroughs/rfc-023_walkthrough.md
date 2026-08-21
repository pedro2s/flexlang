# Walkthrough: Implementação da RFC-023 — `HashMap<K, V>` Tipado

Implementamos com sucesso a especificação [RFC-023](file:///home/pedro/dev/pedro/flexlang/.docs/v0.3/rfcs/rfc-023-hashmap.md) na linguagem FlexLang, introduzindo o tipo genérico `HashMap<K, V>` com construtores estáticos, métodos de consulta e mutação, iteração chave-valor e interoperabilidade nativa com Go.

---

## 🛠️ Recursos Implementados

### 1. Construtores Estáticos
- `HashMap.new()`: Cria uma nova instância de mapa vazio `HashMap<K, V>`.
- `HashMap.from(literal)`: Cria uma instância a partir de um literal chave-valor (`{ "chave": valor }`).

### 2. Métodos de Instância
| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `get` | `map.get(key: K)` | `Option<V>` | Busca segura por chave (`Option.Some` / `Option.None`) |
| `set` | `map.set(key: K, value: V)` | `Void` | Insere ou atualiza (requer `mut`, valida `E3001`) |
| `remove` | `map.remove(key: K)` | `Option<V>` | Remove e devolve valor anterior (requer `mut`) |
| `contains_key` | `map.contains_key(key: K)` | `Bool` | Verifica se a chave existe |
| `len` | `map.len()` | `Int` | Quantidade de entradas |
| `is_empty` | `map.is_empty()` | `Bool` | Verifica se o mapa está vazio |
| `keys` | `map.keys()` | `[K]` | Array com todas as chaves |
| `values` | `map.values()` | `[V]` | Array com todos os valores |

### 3. Iteração
- Suporte a iteração via `for chave, valor in mapa` e `for chave in mapa`.

---

## 🔧 Alterações por Componente

1. **Parser ([`src/parser.ts`](file:///home/pedro/dev/pedro/flexlang/src/parser.ts))**:
   - Helper `consumePropertyName` permitindo palavras-chave contextuais (como `from`) como identificadores de propriedades e métodos estáticos.

2. **Type Checker ([`src/checker.ts`](file:///home/pedro/dev/pedro/flexlang/src/checker.ts))**:
   - `FlexType` estendido com `{ kind: "HashMap"; keyType: FlexType; valueType: FlexType }`.
   - Validação estática de tipos de chave `K` e valor `V`.
   - Checagem estática de mutabilidade (`E3001`) para métodos mutáveis (`set`, `remove`).
   - Resolução de tipos no laço `ForStmt`.

3. **Interpretador ([`src/interpreter.ts`](file:///home/pedro/dev/pedro/flexlang/src/interpreter.ts))**:
   - Execução sobre `Map` do JS com encapsulamento de `Option.Some` e `Option.None`.

4. **Transpiler Go ([`src/transpiler.ts`](file:///home/pedro/dev/pedro/flexlang/src/transpiler.ts))**:
   - Mapeamento de `HashMap<K, V>` para `map[K]V` do Go.
   - `HashMap.new()` gerando `make(map[K]V)`.
   - Métodos gerando operações idiomáticas em Go com closures auxiliares para `Option`.

---

## 🧪 Testes e Validação

### Resultados dos Testes:
1. **Novo Teste Golden [`tests/42_hashmap.flex`](file:///home/pedro/dev/pedro/flexlang/tests/42_hashmap.flex)**:
   - `HashMap.new()`, `set()`, `get()`, `remove()`, `contains_key()`.
   - `len()`, `is_empty()`, `keys()`, `values()`.
   - `HashMap.from({...})`.
2. **Suíte Golden Completa**:
   ```bash
   $ npm test
   Tests Completed: 42 passed, 0 failed.
   ```
3. **Paridade Node ↔ Go**:
   ```bash
   $ npm run test:parity
   Parity gate: 37 passaram, 0 falharam, 5 sem comparação de stdout.
   ```
4. **Testes da Extensão VSCode**:
   ```bash
   $ npm run test:vscode
   ✅ Sucesso: RFC-023: HashMap (new, from, get, set, remove, contains_key, len, is_empty, keys, values) validado
   ✅ Sucesso: RFC-023: set em HashMap imutável emite erro estático E3001
   ✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!
   ```
