# RFC-023 — `HashMap<K, V>` Tipado

> **Status:** Proposto · **Prioridade:** P1 · **Depende de:** RFC-018 (for-in), RFC-021 (Closures)

## 1. Motivação

O `MapLiteral` atual (`ast.ts:406-410`) é um mapa anônimo sem tipagem — serve apenas para construir objetos JSON para `res.json()`. Não há como declarar, tipar, consultar ou iterar sobre mapas. Caches, lookups, contadores, registros dinâmicos e índices são impossíveis.

## 2. Design

### 2.1 Declaração e Construção

```flexlang
// Construtor explícito
let mut accounts: HashMap<String, Account> = HashMap.new();

// Construtor a partir de literal (inferência)
let config = HashMap.from({
    "database_url": "postgres://localhost:5432/flexbank",
    "max_connections": "10",
    "log_level": "info"
});
```

### 2.2 API

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `new` | `HashMap.new()` | `HashMap<K, V>` | Cria mapa vazio |
| `from` | `HashMap.from(map_literal)` | `HashMap<K, V>` | Cria a partir de literal |
| `get` | `map.get(key: K)` | `Option<V>` | Busca por chave |
| `set` | `map.set(key: K, value: V)` | `Void` | Insere ou atualiza (requer `mut`) |
| `remove` | `map.remove(key: K)` | `Option<V>` | Remove e retorna (requer `mut`) |
| `contains_key` | `map.contains_key(key: K)` | `Bool` | Verifica se a chave existe |
| `len` | `map.len()` | `Int` | Número de entradas |
| `is_empty` | `map.is_empty()` | `Bool` | `true` se vazio |
| `keys` | `map.keys()` | `[K]` | Array com todas as chaves |
| `values` | `map.values()` | `[V]` | Array com todos os valores |

### 2.3 Iteração (via RFC-018)

```flexlang
for account_id, account in accounts {
    print("${account_id}: saldo = ${account.balance}");
}
```

### 2.4 Exemplos de Uso no Contexto Bancário

```flexlang
// Cache de taxas de câmbio
let mut exchange_rates: HashMap<String, Decimal> = HashMap.new();
exchange_rates.set("USD_BRL", Decimal.new("5.42"));
exchange_rates.set("EUR_BRL", Decimal.new("5.89"));

match exchange_rates.get("USD_BRL") {
    Option.Some(rate) {
        let converted = amount.mul(rate);
    },
    Option.None {
        log.error("Taxa não encontrada", { pair: "USD_BRL" });
    }
}

// Contadores de transações por tipo
let mut counters: HashMap<String, Int> = HashMap.new();
for tx in transactions {
    let current = counters.get(tx.type_name).unwrap_or(0);
    counters.set(tx.type_name, current + 1);
}
```

## 3. Implementação

### 3.1 Sistema de Tipos

```typescript
// checker.ts - novo FlexType
| { kind: "HashMap"; keyType: FlexType; valueType: FlexType }
```

### 3.2 Transpilação Go

`HashMap<String, Int>` → `map[string]int`

- `HashMap.new()` → `make(map[K]V)`
- `map.get(key)` → Função auxiliar retornando `Option`
- `map.set(key, value)` → `m[key] = value`
- `map.remove(key)` → `delete(m, key)` com retorno do valor anterior
- `map.contains_key(key)` → `_, ok := m[key]; ok`
- `map.keys()` → Loop gerando slice
- `map.values()` → Loop gerando slice

## 4. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/ast.ts` | `FlexType` ganha variante `HashMap` |
| `src/checker.ts` | Validação de métodos de HashMap; inferência de tipos K, V |
| `src/interpreter.ts` | HashMap como `Map<K, V>` do JS |
| `src/transpiler.ts` | Mapeamento para `map[K]V` do Go |

## 5. Plano de Testes

- Golden test: `HashMap.new()`, `set`, `get`, `remove`, `contains_key`
- Golden test: `keys()`, `values()`, `len()`, `is_empty()`
- Golden test: iteração `for key, value in map`
- Golden test: `get` retornando `Option.Some` e `Option.None`
- Golden test: `set` em variável não-`mut` → erro `E3001`
- Parity test: paridade completa

## 6. Critério de Aceite

- [x] HashMap tipado com API completa
- [x] Iteração via `for key, value in map`
- [x] Validação de mutabilidade
- [x] Paridade 100%
