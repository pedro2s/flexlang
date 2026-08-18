# RFC-022 — Conversões de Tipo

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-025 (Decimal)

## 1. Motivação

A FlexLang tem `to_float()` e `to_int()` entre tipos numéricos (RFC-013), mas não há como converter `Int` ou `Float` para `String`, nem parsear uma `String` para número. Isso impede logging estruturado, formatação de respostas, parsing de parâmetros de URL, e integração com módulos que devolvem strings numéricas (como a maioria dos drivers de banco).

## 2. API

### 2.1 Conversões Disponíveis

| Método | De | Para | Retorno | Descrição |
|---|---|---|---|---|
| `to_string()` | `Int` | `String` | `String` | `42` → `"42"` |
| `to_string()` | `Float` | `String` | `String` | `3.14` → `"3.14"` |
| `to_string()` | `Bool` | `String` | `String` | `true` → `"true"` |
| `to_string()` | `Decimal` | `String` | `String` | Decimal → representação textual exata |
| `parse_int(s)` | `String` | `Int` | `Result<Int, String>` | `"42"` → `Ok(42)`, `"abc"` → `Err(...)` |
| `parse_float(s)` | `String` | `Float` | `Result<Float, String>` | `"3.14"` → `Ok(3.14)`, `"abc"` → `Err(...)` |

### 2.2 Exemplos

```flexlang
// Logging de valores numéricos
let account_id = 12345;
log.info("Processando conta", { id: account_id.to_string() });

// Parsing de parâmetro de URL
match parse_int(req.query("page").unwrap_or("1")) {
    Result.Ok(page) {
        fetch_page(page);
    },
    Result.Err(err) {
        res.error(400, "Parâmetro 'page' inválido");
    }
}

// Construção de resposta
let total = calculate_total(items);
res.status(200).json({ total: total.to_string(), currency: "BRL" });
```

## 3. Implementação

### 3.1 `to_string()` — método de instância

Funciona como `to_float()` e `to_int()` já funcionam: o checker reconhece o método no `MemberExpr`/`CallExpr` e valida a aridade.

**Interpretador:** `String(value)` do JS.

**Transpiler Go:**
- `Int.to_string()` → `strconv.Itoa(value)` ou `fmt.Sprintf("%d", value)`
- `Float.to_string()` → `strconv.FormatFloat(value, 'f', -1, 64)`
- `Bool.to_string()` → `strconv.FormatBool(value)`

### 3.2 `parse_int()` / `parse_float()` — funções livres

São funções globais (como `print`) que não precisam de import:

```flexlang
let result = parse_int("42");    // Result<Int, String>
let result = parse_float("3.14"); // Result<Float, String>
```

**Interpretador:** `parseInt()` / `parseFloat()` do JS, com checagem de `NaN`.

**Transpiler Go:**
- `parse_int(s)` → `strconv.Atoi(s)` → wrapping em `Result`
- `parse_float(s)` → `strconv.ParseFloat(s, 64)` → wrapping em `Result`

## 4. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/checker.ts` | `to_string()` para Int/Float/Bool; registro de `parse_int`/`parse_float` como funções globais |
| `src/interpreter.ts` | Implementação nativa de cada conversão |
| `src/transpiler.ts` | Mapeamento para `strconv.*`; add `import "strconv"` |
| `src/stdlib.ts` | Registro de `parse_int`/`parse_float` como builtins |

## 5. Plano de Testes

- Golden test: `42.to_string()` → `"42"`
- Golden test: `3.14.to_string()` → `"3.14"`
- Golden test: `true.to_string()` → `"true"`
- Golden test: `parse_int("42")` → `Result.Ok(42)`
- Golden test: `parse_int("abc")` → `Result.Err(...)`
- Golden test: `parse_float("3.14")` → `Result.Ok(3.14)`
- Parity test: paridade completa

## 6. Critério de Aceite

- [x] `to_string()` funciona para Int, Float, Bool
- [x] `parse_int` e `parse_float` retornam `Result`
- [x] Paridade 100%
