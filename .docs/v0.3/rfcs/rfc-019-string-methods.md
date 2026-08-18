# RFC-019 — Métodos de String

> **Status:** Proposto · **Prioridade:** P0 — bloqueante · **Depende de:** nada

## 1. Motivação

Não existe nenhum método de `String` na FlexLang. Impossível validar CPF (`len`, `contains`, `starts_with`), formatar moeda (`replace`, `split`), normalizar input (`trim`, `to_lower`), ou construir mensagens dinâmicas (`substring`, `index_of`). Num backend financeiro, validação e formatação de strings é onipresente.

## 2. API

Todos os métodos são **imutáveis** — devolvem um novo valor sem alterar a string original.

### 2.1 Métodos Disponíveis

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `len` | `str.len()` | `Int` | Comprimento em caracteres UTF-8 |
| `contains` | `str.contains(sub: String)` | `Bool` | Verifica se contém a substring |
| `starts_with` | `str.starts_with(prefix: String)` | `Bool` | Verifica se começa com o prefixo |
| `ends_with` | `str.ends_with(suffix: String)` | `Bool` | Verifica se termina com o sufixo |
| `to_upper` | `str.to_upper()` | `String` | Converte para maiúsculas |
| `to_lower` | `str.to_lower()` | `String` | Converte para minúsculas |
| `trim` | `str.trim()` | `String` | Remove espaços das bordas |
| `split` | `str.split(sep: String)` | `[String]` | Divide a string pelo separador |
| `replace` | `str.replace(old: String, new: String)` | `String` | Substitui todas as ocorrências |
| `substring` | `str.substring(start: Int, end: Int)` | `String` | Extrai sub-string por índice (end exclusivo) |
| `index_of` | `str.index_of(sub: String)` | `Option<Int>` | Posição da primeira ocorrência |

### 2.2 Exemplos de Uso

```flexlang
// Validação de CPF
func validate_cpf(cpf: String) -> Result<String, String> {
    let cleaned = cpf.replace(".", "").replace("-", "").trim();
    if cleaned.len() != 11 {
        return Result.Err("CPF deve ter 11 dígitos");
    }
    return Result.Ok(cleaned);
}

// Formatação de moeda
func format_brl(value: Decimal) -> String {
    let str = value.to_string();
    let parts = str.split(".");
    return "R$ ${parts[0]},${parts[1]}";
}

// Normalização de email
let email = "  User@Email.COM  ";
let normalized = email.trim().to_lower();
// "user@email.com"
```

## 3. Implementação

### 3.1 Checker (`checker.ts`)

Na seção de `MemberExpr` / `CallExpr` onde `callerType.kind === "String"`, adicionar despacho para cada método com validação de aridade.

### 3.2 Interpretador (`interpreter.ts`)

Despacho nativo: `value.length`, `value.includes()`, `value.startsWith()`, etc. — mapeamento direto para APIs do JS.

### 3.3 Transpiler Go (`transpiler.ts`)

| FlexLang | Go |
|---|---|
| `s.len()` | `len([]rune(s))` |
| `s.contains(sub)` | `strings.Contains(s, sub)` |
| `s.starts_with(p)` | `strings.HasPrefix(s, p)` |
| `s.ends_with(p)` | `strings.HasSuffix(s, p)` |
| `s.to_upper()` | `strings.ToUpper(s)` |
| `s.to_lower()` | `strings.ToLower(s)` |
| `s.trim()` | `strings.TrimSpace(s)` |
| `s.split(sep)` | `strings.Split(s, sep)` |
| `s.replace(old, new)` | `strings.ReplaceAll(s, old, new)` |
| `s.substring(a, b)` | `string([]rune(s)[a:b])` |
| `s.index_of(sub)` | Função auxiliar retornando `Option<Int>` |

O boilerplate Go adiciona `import "strings"` automaticamente.

## 4. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/checker.ts` | Validação de aridade e tipo de retorno dos métodos de String |
| `src/interpreter.ts` | Despacho nativo para cada método |
| `src/transpiler.ts` | Mapeamento para `strings.*` do Go; função auxiliar `string_index_of` |

## 5. Plano de Testes

- Golden test para cada método (entrada → saída esperada)
- Golden test: encadeamento `str.trim().to_lower().split(",")`
- Golden test: `index_of` com `Option.Some` e `Option.None`
- Parity test: paridade completa

## 6. Critério de Aceite

- [x] Todos os 11 métodos funcionam no interpretador
- [x] Todos os 11 métodos transpilam corretamente para Go
- [x] Paridade 100%
