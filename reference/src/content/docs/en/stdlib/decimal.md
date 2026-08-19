---
title: math/decimal — Arbitrary-Precision Math
description: Exact financial and monetary arithmetic without IEEE-754 binary rounding errors.
---

# `math/decimal` — Financial Arithmetic

Standard IEEE-754 floats introduce binary inaccuracies (e.g. `0.1 + 0.2 = 0.30000000000000004`), which is unacceptable in banking. The `math/decimal` module provides exact arbitrary-precision arithmetic.

```flexlang
import { Decimal } from "math/decimal";
```

---

## 🏗️ Constructors

| Method | Signature | Return | Description |
|---|---|---|---|
| `from_string` | `Decimal.from_string(str: String)` | `Result<Decimal, String>` | Parses a string representation (e.g. `"1500.50"`). |
| `from_int` | `Decimal.from_int(val: Int)` | `Decimal` | Instantiates Decimal from an integer. |

```flexlang
let balance = Decimal.from_string("1000.50")?;
let deposit = Decimal.from_string("250.25")?;
let fee = Decimal.from_int(10);
```

---

## 🧮 Operations

| Method | Signature | Return | Description |
|---|---|---|---|
| `add` | `d.add(other: Decimal)` | `Decimal` | Exact addition. |
| `sub` | `d.sub(other: Decimal)` | `Decimal` | Exact subtraction. |
| `mul` | `d.mul(other: Decimal)` | `Decimal` | Exact multiplication. |
| `div` | `d.div(other: Decimal)` | `Result<Decimal, String>` | Exact division (`Err` on division by zero). |
| `pow` | `d.pow(exp: Int)` | `Decimal` | Integer exponentiation. |
| `round` | `d.round(places: Int)` | `Decimal` | Rounds to N fractional digits. |
| `equals` | `d.equals(other: Decimal)` | `Bool` | Value equality test. |
| `to_string` | `d.to_string()` | `String` | Formats into decimal string. |

---

## 💰 Example: Compound Interest Calculation

```flexlang
func compound_interest(principal: Decimal, rate_monthly: Decimal, months: Int) -> Result<Decimal, String> {
    // Total = Principal * (1 + Rate)^Months
    let one = Decimal.from_int(1);
    let base_factor = one.add(rate_monthly);
    let compound_factor = base_factor.pow(months);
    
    let total = principal.mul(compound_factor).round(2);
    return Result.Ok(total);
}

let p = Decimal.from_string("1000.00")?;
let r = Decimal.from_string("0.01")?; // 1% per month
let result = compound_interest(p, r, 12)?;

print("Total Value: $ ${result.to_string()}");
// Prints: Total Value: $ 1126.83
```
