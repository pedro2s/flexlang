# RFC-029 — `catch` Blocks e Padrões Avançados de Tratamento de Erros

> **Status:** Proposto · **Prioridade:** P1 · **Depende de:** nada

## 1. Motivação

O operador `?` propaga erros automaticamente, e `match` permite desestruturar `Result`/`Option`. Mas não há como **interceptar** um erro inline para retry, logging ou fallback customizado — padrões essenciais em backends financeiros que lidam com serviços externos instáveis.

```flexlang
// v0.2 — NÃO EXISTE mecanismo de catch
let result = external_api_call();
// Se falhou, quero fazer retry — mas o ? propaga direto, e match é verboso demais
```

## 2. Design

### 2.1 Bloco `catch`

O bloco `catch` captura o `Result.Err` de uma expressão e permite tratamento inline:

```flexlang
// Forma 1: catch com binding do erro
let user = get_user_from_cache(user_id) catch err {
    log.info("Cache miss, buscando no banco", { user_id: user_id });
    get_user_from_db(user_id)?
};

// Forma 2: catch para retry com fallback
let balance = fetch_balance_from_partner(account_id) catch err {
    log.error("Parceiro indisponível, tentando fallback", { error: err });
    fetch_balance_from_local_db(account_id)?
};
```

### 2.2 Semântica

1. A expressão antes de `catch` deve retornar `Result<T, E>`
2. Se for `Result.Ok(v)`, `v` é atribuído diretamente
3. Se for `Result.Err(e)`, o bloco `catch` é executado com `err` (ou o nome escolhido) vinculado a `e`
4. O bloco `catch` deve retornar um valor do tipo `T` (ou propagar com `?`)

### 2.3 Equivalência com `match`

```flexlang
// Com catch
let user = get_user(id) catch err {
    default_user()
};

// Equivalente com match
let mut user = default_user();
match get_user(id) {
    Result.Ok(u) { user = u; },
    Result.Err(err) { user = default_user(); }
}
```

O `catch` é açúcar sintático que torna o fluxo mais legível em cadeias de operações.

### 2.4 Padrão de Retry

```flexlang
func fetch_with_retry(url: String, max_retries: Int) -> Result<Response, String> {
    let mut attempts = 0;
    while attempts < max_retries {
        let response = http_get(url) catch err {
            attempts = attempts + 1;
            log.info("Retry ${attempts}/${max_retries}", { error: err });
            if attempts >= max_retries {
                return Result.Err("Esgotou tentativas: ${err}");
            }
            continue;
        };
        return Result.Ok(response);
    }
    return Result.Err("Inesperado");
}
```

## 3. Implementação

### 3.1 AST

```typescript
export interface CatchExpr {
  kind: "CatchExpr";
  expression: Expr;    // A expressão que retorna Result<T, E>
  errorBinder: string; // Nome da variável de erro (ex: "err")
  body: BlockStmt;     // Bloco de tratamento
  span?: Span;
}
```

### 3.2 Checker

- Valida que `expression` retorna `Result<T, E>`
- Define `errorBinder` com tipo `E` no escopo do `body`
- Valida que `body` retorna tipo `T`

### 3.3 Transpiler Go

```go
// let user = get_user(id) catch err { default_user() };
__catch1 := get_user(id)
var user User
switch __cv1 := __catch1.(type) {
case Result_Ok:
    user = __cv1.Field0.(*User)
case Result_Err:
    err := __cv1.Field0.(string)
    user = default_user()
}
```

## 4. Plano de Testes

- Golden test: `catch` com fallback simples
- Golden test: `catch` com re-propagação via `?`
- Golden test: `catch` com bloco contendo lógica complexa
- Golden test: `catch` fora de Result → erro do checker
- Parity test: paridade completa
