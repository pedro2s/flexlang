// Teste RFC-025: Módulo math/decimal - Aritmética Monetária de Precisão Arbitrária

import { Decimal } from "math/decimal";

func test_basic_arithmetic() {
    print("--- 1. Aritmetica Basica ---");
    let a = Decimal.new("0.1");
    let b = Decimal.new("0.2");
    let c = a.add(b);
    print("0.1 + 0.2 = ${c.to_string()}");

    let sub = Decimal.new("100.50").sub(Decimal.new("0.25"));
    print("100.50 - 0.25 = ${sub.to_string()}");

    let mul = Decimal.new("12.5").mul(Decimal.new("4.0"));
    print("12.5 * 4.0 = ${mul.to_string()}");

    let div_res = Decimal.new("100.0").div(Decimal.new("4.0"));
    match div_res {
        Result.Ok(val) {
            print("100.0 / 4.0 = ${val.to_string()}");
        },
        Result.Err(msg) {
            print("Erro div: ${msg}");
        }
    }

    let zero_div = Decimal.new("10.0").div(Decimal.new("0.0"));
    match zero_div {
        Result.Ok(val) {
            print("Div zero ok");
        },
        Result.Err(msg) {
            print("Div por zero esperada: ${msg}");
        }
    }

    let rem = Decimal.new("10.5").modulo(Decimal.new("3.0"));
    print("10.5 % 3.0 = ${rem.to_string()}");

    let neg = Decimal.new("42.75").neg();
    print("neg(42.75) = ${neg.to_string()}");

    let abs = Decimal.new("-99.99").abs();
    print("abs(-99.99) = ${abs.to_string()}");
}

func test_rounding_and_pow() {
    print("--- 2. Arredondamento e Potencia ---");
    let r1 = Decimal.new("2.5").round(0);
    let r2 = Decimal.new("3.5").round(0);
    let r3 = Decimal.new("2.55").round(1);
    let r4 = Decimal.new("2.54").round(1);
    let r5 = Decimal.new("2.56").round(1);
    print("round(2.5, 0) = ${r1.to_string()}");
    print("round(3.5, 0) = ${r2.to_string()}");
    print("round(2.55, 1) = ${r3.to_string()}");
    print("round(2.54, 1) = ${r4.to_string()}");
    print("round(2.56, 1) = ${r5.to_string()}");

    let p = Decimal.new("2.0").pow(4);
    print("2.0 ^ 4 = ${p.to_string()}");
}

func test_comparisons_and_conversions() {
    print("--- 3. Comparacoes e Conversoes ---");
    let d10 = Decimal.new("10.00");
    let d20 = Decimal.new("20.00");
    let d10_dup = Decimal.from_int(10);

    print("10 == 10: ${d10.eq(d10_dup)}");
    print("10 < 20: ${d10.lt(d20)}");
    print("20 > 10: ${d20.gt(d10)}");
    print("10 <= 10: ${d10.lte(d10_dup)}");
    print("20 >= 10: ${d20.gte(d10)}");
    print("cmp(10, 20): ${d10.cmp(d20)}");

    let z = Decimal.from_int(0);
    print("is_zero(0): ${z.is_zero()}");
    print("is_pos(10): ${d10.is_positive()}");
    let d_neg = Decimal.new("-5.0");
    print("is_neg(-5): ${d_neg.is_negative()}");

    let pi_dec = Decimal.new("3.14159");
    print("to_float: ${pi_dec.to_float()}");
    print("to_int: ${pi_dec.to_int()}");
}

func test_banking_split() -> Result<Int, String> {
    print("--- 4. Caso de Uso Bancario (Split de Pagamento) ---");
    let total = Decimal.new("100.00");
    let installments = 3;
    let raw_part = total.div(Decimal.from_int(installments))?;
    let rounded = raw_part.round(2);

    let mut sum = Decimal.new("0.00");
    for i in 0..(installments - 1) {
        print("Parcela: ${rounded.to_string()}");
        sum = sum.add(rounded);
    }
    let last = total.sub(sum);
    print("Ultima parcela: ${last.to_string()}");
    let final_sum = sum.add(last);
    print("Soma total conferida: ${final_sum.to_string()}");
    return Result.Ok(0);
}

func main() {
    test_basic_arithmetic();
    test_rounding_and_pow();
    test_comparisons_and_conversions();
    test_banking_split();
}

main();
