# RFC-018 — `for item in collection` (Iteração sobre Arrays, Maps e Ranges)

> **Status:** Proposto · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-017 (break/continue)

## 1. Motivação

O `for` atual (`parser.ts:ForStmt`) só aceita ranges numéricos (`for i in 0..10`). Isso torna impossível iterar sobre arrays ou mapas — exatamente as coleções que um backend manipula o tempo todo (listas de transações, resultados de queries, registros de auditoria).

```flexlang
// v0.2 — IMPOSSÍVEL
let transacoes = get_transactions(account_id);
for tx in transacoes {       // ← erro de parsing
    process(tx);
}
```

## 2. Design

### 2.1 Nova Sintaxe

```flexlang
// Iteração sobre Array
for item in items {
    print(item);
}

// Iteração sobre Array com índice
for item, index in items {
    print("${index}: ${item}");
}

// Iteração sobre Range (mantém compatibilidade)
for i in 0..10 {
    print(i);
}

// Iteração sobre HashMap (RFC-023)
for key, value in accounts {
    print("${key} -> ${value}");
}
```

### 2.2 Mudança na AST

```typescript
// ast.ts - ForStmt expandido
export interface ForStmt {
  kind: "ForStmt";
  iteratorName: string;
  indexName?: string;        // NOVO: nome da variável de índice (opcional)
  iterable: Expr;            // NOVO: expressão iterável (array, map, range)
  // Campos legados removidos:
  // start: Expr;  ← substituído por iterable
  // end: Expr;    ← substituído por iterable
  body: BlockStmt;
  span?: Span;
}

// Range como expressão (para uso em for..in e futuramente em outros contextos)
export interface RangeExpr {
  kind: "RangeExpr";
  start: Expr;
  end: Expr;
  span?: Span;
}
```

### 2.3 Checagem de Tipos

O checker valida que a expressão iterável é um dos tipos suportados:
- `Array<T>` → iterator produz `T` (e opcionalmente `Int` para índice)
- `HashMap<K, V>` → iterator produz `K` e `V`
- `RangeExpr` → iterator produz `Int`

Erro `E2033`: "Tipo `X` não é iterável" para qualquer outro tipo.

### 2.4 Transpilação Go

```flexlang
for tx in transactions {
    print(tx.amount);
}
```

→ Go:

```go
for _, tx := range transactions {
    fmt.Println(tx.Amount)
}
```

Com índice:

```flexlang
for tx, i in transactions {
    print("${i}: ${tx.amount}");
}
```

→ Go:

```go
for i, tx := range transactions {
    fmt.Printf("%d: %v\n", i, tx.Amount)
}
```

### 2.5 Interpretador

O interpretador avalia `iterable`, verifica o tipo em runtime e itera:
- Array: `for (const [index, item] of array.entries())`
- Map: `for (const [key, value] of map.entries())`
- Range: `for (let i = start; i < end; i++)`

## 3. Migração

O `ForStmt` antigo com `start`/`end` é substituído internamente. A sintaxe `for i in 0..10 { }` continua funcionando — o parser gera um `ForStmt` com `iterable: RangeExpr(0, 10)`.

## 4. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/ast.ts` | `ForStmt` redesenhado; novo `RangeExpr` |
| `src/parser.ts` | Parser de `for` expandido para aceitar expressões como iterável |
| `src/checker.ts` | Validação de iterabilidade; inferência de tipo do iterator |
| `src/interpreter.ts` | Execução de for-in sobre arrays, maps e ranges |
| `src/transpiler.ts` | Emissão de `for _, v := range` no Go |

## 5. Plano de Testes

- Golden test: `for item in array`
- Golden test: `for item, index in array`
- Golden test: `for i in 0..10` (regressão)
- Golden test: `for key, value in hashmap`
- Golden test: `break` dentro de `for item in array`
- Golden test: tipo não-iterável → erro `E2033`
- Parity test: paridade completa

## 6. Critério de Aceite

- [x] Iteração sobre arrays com e sem índice
- [x] Iteração sobre ranges (regressão)
- [x] Iteração sobre HashMaps
- [x] `break`/`continue` funcionam dentro de `for..in`
- [x] Paridade 100%
