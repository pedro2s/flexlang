# RFC-021 — Closures com Captura de Escopo

> **Status:** Proposto · **Prioridade:** P0 — bloqueante · **Depende de:** nada

## 1. Motivação

Lambdas (`LambdaExpr`) existem na FlexLang desde a v0.1.0 — usadas como callbacks de rotas HTTP (`server.get("/path", |req, res| { ... })`). Porém, elas **não capturam variáveis do escopo envolvente**, limitando severamente seu uso para funções de alta ordem como `map`, `filter`, `find`.

```flexlang
let threshold = 100;
let results = items.filter(|item| {
    return item.value > threshold;  // ← ERRO: 'threshold' não está definido
});
```

## 2. Design

### 2.1 Semântica de Captura

A closure captura variáveis do escopo envolvente **por referência** (no interpretador, via encadeamento de `Environment`; no Go, via captura implícita da closure Go gerada).

**Regras:**
1. Variáveis capturadas são **read-only por default** dentro da closure.
2. Se a variável capturada foi declarada com `mut` e a closure precisa mutá-la, a variável deve estar acessível via referência (o Go trata isso nativamente com closures sobre variáveis locais).
3. O tipo da closure é inferido pelo checker com base nos tipos dos parâmetros e do retorno.

### 2.2 Sintaxe (sem mudança)

A sintaxe de lambda já existente é a sintaxe de closures:

```flexlang
// Captura `threshold` do escopo envolvente
let threshold = Decimal.new("1000.00");
let high_value = transactions.filter(|tx| {
    return tx.amount.gt(threshold);
});

// Captura `mut total` e o muta
let mut total = Decimal.new("0.00");
transactions.for_each(|tx| {
    total = total.add(tx.amount);
});
```

### 2.3 Mudança no Interpretador

A classe `FlexFunction` já armazena um `closure: Environment`. A mudança é garantir que, ao avaliar uma `LambdaExpr`, o interpretador crie a `FlexFunction` com uma referência ao `Environment` **atual** (não ao global).

```typescript
// interpreter.ts - ao avaliar LambdaExpr
case "LambdaExpr": {
  // ANTES: não capturava nada
  // DEPOIS: captura o environment corrente
  return new FlexFunction(
    { kind: "FunctionDeclaration", name: "__lambda", parameters: expr.parameters, body: expr.body },
    this.env // ← captura do escopo envolvente
  );
}
```

### 2.4 Transpilação Go

As closures Go capturam variáveis do escopo envolvente nativamente — não há trabalho extra:

```flexlang
let min_amount = Decimal.new("50.00");
let filtered = items.filter(|item| {
    return item.amount.gt(min_amount);
});
```

→ Go:

```go
minAmount := decimal_new("50.00")
filtered := array_filter(items, func(item *Transaction) bool {
    return item.Amount.Cmp(minAmount) > 0
})
```

## 3. Verificação de Move Semantics

Se uma variável `mut` é capturada por uma closure e essa closure é passada para `spawn`, o checker verifica que a variável não é usada após o `spawn` — consistente com o sistema existente de move semantics para `Channel.send`.

## 4. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/interpreter.ts` | `LambdaExpr` captura `this.env` ao invés de escopo vazio |
| `src/checker.ts` | Validação de variáveis capturadas; inferência de tipo da closure |
| `src/transpiler.ts` | Emissão de funções anônimas Go com captura implícita |

## 5. Plano de Testes

- Golden test: closure capturando variável imutável
- Golden test: closure capturando variável `mut` e mutando
- Golden test: closure aninhada (closure dentro de closure)
- Golden test: closure como argumento de `map`, `filter`, `find`
- Parity test: paridade completa

## 6. Critério de Aceite

- [x] Closures capturam variáveis do escopo envolvente
- [x] Variáveis `mut` capturadas podem ser mutadas
- [x] Closures funcionam como argumentos de métodos de alta ordem
- [x] Paridade 100%
