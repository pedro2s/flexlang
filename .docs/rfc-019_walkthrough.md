# Walkthrough: Implementação da RFC-019 — Métodos de String

Implementamos com sucesso a especificação [RFC-019](file:///home/pedro/dev/pedro/flexlang/.docs/v0.3/rfcs/rfc-019-string-methods.md) na linguagem FlexLang, introduzindo uma API padrão, imutável e com suporte completo a caracteres UTF-8 para strings.

---

## 🛠️ Métodos Implementados

| Método | Assinatura | Retorno | Mapeamento Go |
|---|---|---|---|
| `len` | `str.len()` | `Int` | `len([]rune(s))` |
| `contains` | `str.contains(sub: String)` | `Bool` | `strings.Contains(s, sub)` |
| `starts_with` | `str.starts_with(prefix: String)` | `Bool` | `strings.HasPrefix(s, prefix)` |
| `ends_with` | `str.ends_with(suffix: String)` | `Bool` | `strings.HasSuffix(s, suffix)` |
| `to_upper` | `str.to_upper()` | `String` | `strings.ToUpper(s)` |
| `to_lower` | `str.to_lower()` | `String` | `strings.ToLower(s)` |
| `trim` | `str.trim()` | `String` | `strings.TrimSpace(s)` |
| `split` | `str.split(sep: String)` | `[String]` | `strings.Split(s, sep)` |
| `replace` | `str.replace(old: String, new: String)` | `String` | `strings.ReplaceAll(s, old, new)` |
| `substring` | `str.substring(start: Int, end: Int)` | `String` | `string([]rune(s)[start:end])` |
| `index_of` | `str.index_of(sub: String)` | `Option<Int>` | `flex_string_index_of(s, sub)` |

---

## 🔧 Alterações por Componente

1. **Type Checker ([`src/checker.ts`](file:///home/pedro/dev/pedro/flexlang/src/checker.ts))**:
   - Validação de aridade (`E2012`) e verificação estática de tipos de argumentos e retornos.
   - Retorno de `Option<Int>` para `index_of`.
   - Emissão de `E2024` para métodos inexistentes em String.

2. **Interpretador ([`src/interpreter.ts`](file:///home/pedro/dev/pedro/flexlang/src/interpreter.ts))**:
   - Despacho nativo de operações sobre strings respeitando runes/caracteres UTF-8.
   - Integração com `optionSome` e `optionNone` da biblioteca padrão.

3. **Transpiler Go ([`src/transpiler.ts`](file:///home/pedro/dev/pedro/flexlang/src/transpiler.ts))**:
   - Emissão de chamadas para o pacote `strings` da stdlib do Go.
   - Geração automática da função auxiliar `flex_string_index_of(s, sub string) Option` quando `index_of` é utilizado.

---

## 🧪 Testes e Validação

### Testes Executados:
1. **Novo Teste Golden [`tests/38_string_methods.flex`](file:///home/pedro/dev/pedro/flexlang/tests/38_string_methods.flex)**:
   - Validação de todos os 11 métodos.
   - Validação de contagem UTF-8 (`Ação`.len() = 4).
   - Encadeamento de métodos (`str.trim().to_upper()`, `cpf.replace(...).replace(...)`).
   - Casos com `Option.Some` e `Option.None` para `index_of`.
2. **Suíte Golden Completa**:
   ```bash
   $ npm test
   Tests Completed: 38 passed, 0 failed.
   ```
3. **Paridade Node ↔ Go**:
   ```bash
   $ npm run test:parity
   Parity gate: 33 passaram, 0 falharam, 5 sem comparação de stdout.
   ```
4. **Testes da Extensão VSCode**:
   ```bash
   $ npm run test:vscode
   ✅ Sucesso: RFC-019: métodos de String (len, trim, upper, contains, split, replace, substring, index_of) validados
   ✅ Sucesso: RFC-019: método inexistente em String emite erro estático E2024
   ✅ Sucesso: RFC-019: aridade incorreta em método de String emite erro estático E2012
   ✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!
   ```
