// Teste RFC-022: Conversões de Tipo Explícitas

func test_to_string() {
    print("--- Teste to_string ---");
    let n = 42;
    let s_n = n.to_string();
    print("Int: ${s_n}");

    let neg = -100;
    let s_neg = neg.to_string();
    print("Neg: ${s_neg}");

    let pi = 3.14;
    let s_pi = pi.to_string();
    print("Float: ${s_pi}");

    let b_true = true;
    let s_bt = b_true.to_string();
    print("Bool true: ${s_bt}");

    let b_false = false;
    let s_bf = b_false.to_string();
    print("Bool false: ${s_bf}");
}

func test_parsing() {
    print("--- Teste Parsing ---");
    match parse_int("12345") {
        Result.Ok(val) {
            print("Int parse Ok: ${val}");
        },
        Result.Err(err) {
            print("Int parse Err");
        }
    }

    match parse_int("nao_eh_numero") {
        Result.Ok(val) {
            print("Int parse Ok: ${val}");
        },
        Result.Err(err) {
            print("Int parse detectou erro com sucesso");
        }
    }

    match parse_float("99.95") {
        Result.Ok(val) {
            print("Float parse Ok: ${val}");
        },
        Result.Err(err) {
            print("Float parse Err");
        }
    }

    match parse_float("texto_invalido") {
        Result.Ok(val) {
            print("Float parse Ok: ${val}");
        },
        Result.Err(err) {
            print("Float parse detectou erro com sucesso");
        }
    }
}

func soma_valores(str_a: String, str_b: String) -> Result<Int, String> {
    let a = parse_int(str_a)?;
    let b = parse_int(str_b)?;
    return Result.Ok(a + b);
}

func test_propagation() {
    print("--- Teste Propagacao com Try ---");
    match soma_valores("10", "20") {
        Result.Ok(total) {
            print("Soma Ok: ${total}");
        },
        Result.Err(err) {
            print("Soma Falhou");
        }
    }

    match soma_valores("10", "abc") {
        Result.Ok(total) {
            print("Soma Ok: ${total}");
        },
        Result.Err(err) {
            print("Soma falhou corretamente com Try");
        }
    }
}

func main() {
    test_to_string();
    test_parsing();
    test_propagation();
}

main();
