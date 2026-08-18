# RFC-020 — Métodos de Array

> **Status:** Proposto · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-021 (Closures, para `map`/`filter`/`find`)

## 1. Motivação

Arrays na FlexLang suportam apenas acesso por índice (`arr[0]`) e literais (`[1, 2, 3]`). Não há como obter o tamanho, adicionar/remover elementos, buscar, filtrar ou transformar. Num backend financeiro, operar sobre listas de transações, contas e registros é operação fundamental.

## 2. API

### 2.1 Métodos Imutáveis (não alteram o array)

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `len` | `arr.len()` | `Int` | Número de elementos |
| `is_empty` | `arr.is_empty()` | `Bool` | `true` se `len() == 0` |
| `contains` | `arr.contains(item: T)` | `Bool` | Verifica se o item existe (igualdade) |
| `find` | `arr.find(predicate: \|T\| -> Bool)` | `Option<T>` | Primeiro elemento que satisfaz o predicado |
| `map` | `arr.map(transform: \|T\| -> U)` | `[U]` | Transforma cada elemento |
| `filter` | `arr.filter(predicate: \|T\| -> Bool)` | `[T]` | Filtra elementos que satisfazem o predicado |
| `slice` | `arr.slice(start: Int, end: Int)` | `[T]` | Sub-array (end exclusivo) |
| `concat` | `arr.concat(other: [T])` | `[T]` | Concatena dois arrays |
| `for_each` | `arr.for_each(action: \|T\| -> Void)` | `Void` | Executa ação para cada elemento |

### 2.2 Métodos Mutáveis (requerem `mut`)

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `push` | `arr.push(item: T)` | `Void` | Adiciona ao final |
| `pop` | `arr.pop()` | `Option<T>` | Remove e retorna o último |
| `sort` | `arr.sort()` | `Void` | Ordena in-place (tipos comparáveis) |

### 2.3 Exemplos de Uso

```flexlang
let transactions = get_recent_transactions(account_id);

// Filtrar transações acima de R$ 1000
let high_value = transactions.filter(|tx| { return tx.amount > Decimal.new("1000.00"); });

// Calcular total
let mut total = Decimal.new("0.00");
high_value.for_each(|tx| {
    total = total.add(tx.amount);
});

// Buscar transação por ID
match transactions.find(|tx| { return tx.id == target_id; }) {
    Option.Some(tx) {
        print("Encontrada: ${tx.description}");
    },
    Option.None {
        print("Transação não encontrada");
    }
}

// Mapear para extrato
let statements = transactions.map(|tx| {
    return "${tx.date}: ${tx.description} - ${tx.amount}";
});
```

## 3. Implementação

### 3.1 Checker

Métodos mutáveis (`push`, `pop`, `sort`) exigem que o objeto raiz tenha sido declarado com `mut`. O checker valida isso percorrendo a cadeia de `MemberExpr` até o `Identifier` raiz.

Métodos que recebem closures (`map`, `filter`, `find`, `for_each`) validam:
- A closure tem exatamente 1 parâmetro
- O tipo do parâmetro é `T` (o `elementType` do array)
- O tipo de retorno é consistente com o método

### 3.2 Transpilação Go

- `arr.len()` → `len(arr)`
- `arr.push(x)` → `arr = append(arr, x)`
- `arr.pop()` → Função auxiliar `array_pop[T](arr *[]T) Option`
- `arr.map(f)` → Loop with append
- `arr.filter(f)` → Loop with conditional append
- `arr.find(f)` → Loop with early return
- `arr.contains(x)` → Loop with comparison
- `arr.sort()` → `sort.Slice(arr, func(i, j int) bool { return arr[i] < arr[j] })`

## 4. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/checker.ts` | Validação de cada método, checagem de mutabilidade, inferência de closure |
| `src/interpreter.ts` | Implementação nativa de cada método via JS arrays |
| `src/transpiler.ts` | Funções auxiliares Go para `pop`, `map`, `filter`, `find` |

## 5. Plano de Testes

- Golden test para cada método
- Golden test: `push` em variável não-`mut` → erro `E3001`
- Golden test: `map`/`filter` com closure
- Golden test: `find` retornando `Option.Some` e `Option.None`
- Golden test: `pop` em array vazio → `Option.None`
- Parity test: paridade completa

## 6. Critério de Aceite

- [x] Todos os métodos imutáveis funcionam
- [x] Métodos mutáveis validam `mut`
- [x] Closures como argumento de `map`/`filter`/`find`/`for_each`
- [x] Paridade 100%
