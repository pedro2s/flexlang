---
title: math/decimal — Aritmética de Precisão Arbitrária
description: Cálculos monetários e financeiros exatos sem erros binários de ponto flutuante.
---

Pontos flutuantes tradicionais (`Float` IEEE-754) sofrem com imprecisões binárias (ex: `0.1 + 0.2 = 0.30000000000000004`), o que é inaceitável em finanças. O módulo `math/decimal` resolve isso com precisão decimal exata.

```flexlang
import { Decimal } from "math/decimal";
```

---

## 🏗️ Construtores

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `from_string` | `Decimal.from_string(str: String)` | `Result<Decimal, String>` | Cria Decimal a partir de string (ex: `"1500.50"`). |
| `from_int` | `Decimal.from_int(val: Int)` | `Decimal` | Cria Decimal a partir de número inteiro. |

```flexlang
let saldo = Decimal.from_string("1000.50")?;
let deposito = Decimal.from_string("250.25")?;
let taxa = Decimal.from_int(10);
```

---

## 🧮 Operações Aritméticas

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `add` | `d.add(other: Decimal)` | `Decimal` | Soma decimal exata. |
| `sub` | `d.sub(other: Decimal)` | `Decimal` | Subtração decimal. |
| `mul` | `d.mul(other: Decimal)` | `Decimal` | Multiplicação exata. |
| `div` | `d.div(other: Decimal)` | `Result<Decimal, String>` | Divisão (retorna `Err` se divisor for zero). |
| `pow` | `d.pow(exp: Int)` | `Decimal` | Potenciação inteira. |
| `round` | `d.round(casas: Int)` | `Decimal` | Arredonda para N casas decimais. |
| `equals` | `d.equals(other: Decimal)` | `Bool` | Compara igualdade de valor. |
| `to_string` | `d.to_string()` | `String` | Formata em texto decimal. |

---

## 💰 Exemplo: Cálculo de Juros Compostos

```flexlang
func simular_juros(capital: Decimal, taxa_mensal: Decimal, meses: Int) -> Result<Decimal, String> {
    // Montante = Capital * (1 + Taxa)^Meses
    let um = Decimal.from_int(1);
    let fator_base = um.add(taxa_mensal);
    let fator_composto = fator_base.pow(meses);
    
    let montante = capital.mul(fator_composto).round(2);
    return Result.Ok(montante);
}

let c = Decimal.from_string("1000.00")?;
let i = Decimal.from_string("0.01")?; // 1% ao mês
let final = simular_juros(c, i, 12)?;

print("Montante Final: R$ ${final.to_string()}");
// Imprime: Montante Final: R$ 1126.83
```
