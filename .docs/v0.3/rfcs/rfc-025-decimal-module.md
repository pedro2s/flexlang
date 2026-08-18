# RFC-025 — Módulo `math/decimal` — Aritmética Monetária de Precisão Arbitrária

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-022 (to_string para Decimal)

## 1. Motivação

IEEE 754 `Float` é **inaceitável para cálculos financeiros**:

```
0.1 + 0.2 = 0.30000000000000004  (IEEE 754)
0.1 + 0.2 = 0.3                  (Decimal)
```

Em um backend de banco, erros de arredondamento em saldos, transferências, juros e taxas podem causar divergências contábeis, violações regulatórias e perda financeira real. O tipo `Float` da FlexLang (IEEE 754 de 64 bits) herda exatamente esses problemas.

Linguagens usadas em finanças resolvem isso com tipos decimais nativos:
- **Java**: `BigDecimal`
- **C#**: `decimal` (128-bit)
- **Python**: `decimal.Decimal`
- **Go**: `shopspring/decimal` (biblioteca mais usada)

A FlexLang precisa de um `Decimal` nativo na stdlib para ser viável em domínios financeiros.

## 2. Design

### 2.1 Construção

```flexlang
import { Decimal } from "math/decimal";

// A PARTIR DE STRING — forma canônica e mais segura
let saldo = Decimal.new("1500.75");
let taxa = Decimal.new("0.015");
let zero = Decimal.new("0.00");

// A PARTIR DE INT
let quantidade = Decimal.from_int(42);
```

> **Decisão de design:** Não há construtor a partir de Float. `Decimal.new(0.1)` seria enganoso porque `0.1` já perdeu precisão ao ser representado como Float. A forma canônica é sempre a partir de String.

### 2.2 API Completa

#### Operações Aritméticas (imutáveis — retornam novo Decimal)

| Método | Assinatura | Descrição |
|---|---|---|
| `add` | `d.add(other: Decimal)` → `Decimal` | Soma |
| `sub` | `d.sub(other: Decimal)` → `Decimal` | Subtração |
| `mul` | `d.mul(other: Decimal)` → `Decimal` | Multiplicação |
| `div` | `d.div(other: Decimal)` → `Result<Decimal, String>` | Divisão (Err se divisor = 0) |
| `modulo` | `d.modulo(other: Decimal)` → `Decimal` | Módulo (resto da divisão) |
| `neg` | `d.neg()` → `Decimal` | Negação (-d) |
| `abs` | `d.abs()` → `Decimal` | Valor absoluto |
| `round` | `d.round(places: Int)` → `Decimal` | Arredondamento bancário (half-even) |
| `pow` | `d.pow(exp: Int)` → `Decimal` | Potenciação inteira |

#### Comparações

| Método | Assinatura | Descrição |
|---|---|---|
| `eq` | `d.eq(other: Decimal)` → `Bool` | Igualdade exata |
| `gt` | `d.gt(other: Decimal)` → `Bool` | Maior que |
| `lt` | `d.lt(other: Decimal)` → `Bool` | Menor que |
| `gte` | `d.gte(other: Decimal)` → `Bool` | Maior ou igual |
| `lte` | `d.lte(other: Decimal)` → `Bool` | Menor ou igual |
| `is_zero` | `d.is_zero()` → `Bool` | Verifica se é zero |
| `is_positive` | `d.is_positive()` → `Bool` | Verifica se é positivo |
| `is_negative` | `d.is_negative()` → `Bool` | Verifica se é negativo |
| `cmp` | `d.cmp(other: Decimal)` → `Int` | -1, 0 ou 1 |

#### Conversões

| Método | Assinatura | Descrição |
|---|---|---|
| `to_string` | `d.to_string()` → `String` | Representação textual exata |
| `to_float` | `d.to_float()` → `Float` | Conversão com possível perda de precisão |
| `to_int` | `d.to_int()` → `Int` | Trunca parte fracionária |

### 2.3 Exemplos de Uso no Contexto Bancário

```flexlang
import { Decimal } from "math/decimal";

// Transferência entre contas
func transfer(from_balance: Decimal, to_balance: Decimal, amount: Decimal) -> Result<{ from: Decimal, to: Decimal }, String> {
    if amount.lte(Decimal.new("0.00")) {
        return Result.Err("Valor deve ser positivo");
    }
    if from_balance.lt(amount) {
        return Result.Err("Saldo insuficiente");
    }
    return Result.Ok({
        from: from_balance.sub(amount),
        to: to_balance.add(amount)
    });
}

// Cálculo de juros compostos
func compound_interest(principal: Decimal, annual_rate: Decimal, months: Int) -> Decimal {
    // Montante = P * (1 + r/12)^n
    let monthly_rate = annual_rate.div(Decimal.from_int(12))?;
    let base = Decimal.new("1.00").add(monthly_rate);
    let mut amount = principal;
    for i in 0..months {
        amount = amount.mul(base);
    }
    return amount.round(2);
}

// Split de pagamento
func split_payment(total: Decimal, installments: Int) -> [Decimal] {
    let installment_value = total.div(Decimal.from_int(installments))?;
    let rounded = installment_value.round(2);
    let mut result: [Decimal] = [];
    let mut sum = Decimal.new("0.00");
    for i in 0..(installments - 1) {
        result.push(rounded);
        sum = sum.add(rounded);
    }
    // Última parcela absorve a diferença de arredondamento
    result.push(total.sub(sum));
    return result;
}
```

## 3. Implementação

### 3.1 Modo Interpretado (TypeScript)

Usar aritmética de string internamente. A implementação pode usar a API `Intl.NumberFormat` do JS para formatação, mas a aritmética deve ser feita com uma classe `BigDecimal` interna que armazena o valor como string ou bigint + expoente.

```typescript
class FlexDecimal {
  readonly [NATIVE_TAG] = "Decimal";
  private readonly value: bigint;
  private readonly scale: number; // número de casas decimais

  constructor(str: string) {
    // "1500.75" → value = 150075n, scale = 2
    const parts = str.split(".");
    this.scale = parts[1]?.length ?? 0;
    this.value = BigInt(parts.join(""));
  }

  add(other: FlexDecimal): FlexDecimal { /* ... */ }
  sub(other: FlexDecimal): FlexDecimal { /* ... */ }
  mul(other: FlexDecimal): FlexDecimal { /* ... */ }
  div(other: FlexDecimal): EnumVariantValue { /* Result */ }
  // ...
}
```

### 3.2 Modo Compilado (Go)

Usar a biblioteca `shopspring/decimal` (`github.com/shopspring/decimal`), que é o padrão de facto em Go para aritmética decimal:

```go
import "github.com/shopspring/decimal"

func decimal_new(s string) decimal.Decimal {
    d, err := decimal.NewFromString(s)
    if err != nil {
        panic("invalid decimal: " + s)
    }
    return d
}

func decimal_from_int(n int) decimal.Decimal {
    return decimal.NewFromInt(int64(n))
}
```

O boilerplate Go do módulo deve:
1. Adicionar `import "github.com/shopspring/decimal"` ao arquivo gerado
2. Emitir um `go.mod` com a dependência ou documentar que o usuário precisa rodar `go get`

### 3.3 Integração com `res.json()`

Quando `res.json()` serializa um valor `Decimal`, ele deve produzir o valor numérico como string JSON para preservar a precisão:

```json
{ "balance": "1500.75", "currency": "BRL" }
```

## 4. Alternativas Descartadas

| Alternativa | Razão |
|---|---|
| Operadores (`+`, `-`, `*`, `/`) para Decimal | Sobrecarrega de operadores não existe na FlexLang e adicionaria complexidade no parser/checker |
| Decimal como tipo primitivo da linguagem | Muito invasivo — exigiria mudanças no lexer, parser e AST. Módulo nativo é mais modular |
| Usar Float com arredondamento | Não resolve — erros de acumulação persistem em cadeias de operações |

## 5. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/modules/decimal.ts` | **NOVO** — Módulo nativo completo |
| `src/modules/registry.ts` | Registrar `math/decimal` |
| `src/modules/types.ts` | NativeType `Decimal` com todos os métodos |

## 6. Plano de Testes

### 6.1 Golden Tests
- `Decimal.new("0.1").add(Decimal.new("0.2")).to_string()` → `"0.3"` (não `"0.30000000000000004"`)
- `Decimal.new("100.00").div(Decimal.new("3"))` arredondado para 2 casas → `"33.33"`
- `Decimal.new("0.00").div(Decimal.new("0.00"))` → `Result.Err("division by zero")`
- Juros compostos: `1000 * (1 + 0.01)^12` → verificar contra resultado conhecido
- Split de pagamento: `100.00 / 3` → `[33.34, 33.33, 33.33]` (soma = 100.00)

### 6.2 Parity Tests
- Todos os operadores produzem resultado idêntico em TS e Go
- Serialização JSON idêntica

### 6.3 Segurança
- Strings inválidas em `Decimal.new("abc")` → panic controlado
- Overflow em operações extremas → comportamento documentado

## 7. Critério de Aceite

- [x] `0.1 + 0.2 = 0.3` — sem erro de arredondamento
- [x] Todas as 9 operações aritméticas funcionam
- [x] Todas as 8 comparações funcionam
- [x] `div` por zero retorna `Result.Err`
- [x] Arredondamento bancário (half-even) em `round`
- [x] Integração com `res.json()` preserva precisão
- [x] Paridade 100% entre interpretador e Go
