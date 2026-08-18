// Serviço de Cálculo de Juros Compostos (RFC-025)

import { Decimal } from "math/decimal";

// Simula juros compostos: M = P * (1 + i)^n
func simulate_compound_interest(principal_str: String, monthly_rate_str: String, months: Int) -> Result<String, String> {
    let p = Decimal.new(principal_str);
    let r = Decimal.new(monthly_rate_str);
    let one = Decimal.new("1.0");
    let base = one.add(r);
    let factor = base.pow(months);
    let total = p.mul(factor);
    let rounded = total.round(2);
    return Result.Ok(rounded.to_string());
}
