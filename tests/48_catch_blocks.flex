// Teste RFC-029: catch Blocks e Padrões Avançados de Tratamento de Erros

func parse_or_default(s: String, default_val: Int) -> Int {
    let val = parse_int(s) catch err {
        let has_err = err != "";
        print("Falha no parse capturada: ${has_err}");
        default_val
    };
    return val;
}

func success_call() -> Result<String, String> {
    return Result.Ok("dados_sucesso");
}

func fail_call(reason: String) -> Result<String, String> {
    return Result.Err(reason);
}

func test_catch_basics() {
    print("--- 1. Catch Basico ---");
    let n1 = parse_or_default("42", 0);
    print("Parse valido: ${n1}");

    let n2 = parse_or_default("invalido", 100);
    print("Parse invalido com fallback: ${n2}");

    let s1 = success_call() catch err {
        print("Nao deve executar: ${err}");
        "fallback_nao_usado"
    };
    print("Sucesso: ${s1}");

    let s2 = fail_call("timeout_servico") catch err {
        print("Erro capturado: ${err}");
        "fallback_usado"
    };
    print("Resultado apos catch: ${s2}");
}

func try_helper(should_fail: Bool) -> Result<String, String> {
    let mut res = "";
    if (should_fail) {
        let val = fail_call("erro_propagado") catch err {
            print("Log intermediario: ${err}");
            fail_call("erro_reempacotado")?
        };
        res = val;
    } else {
        let val = success_call() catch err {
            "fallback"
        };
        res = val;
    }
    return Result.Ok(res);
}

func test_catch_with_propagation() {
    print("--- 2. Catch com Propagacao ---");
    let r1 = try_helper(false);
    match r1 {
        Result.Ok(v) { print("Sucesso try_helper: ${v}"); },
        Result.Err(e) { print("Erro try_helper: ${e}"); }
    }

    let r2 = try_helper(true);
    match r2 {
        Result.Ok(v) { print("Sucesso try_helper: ${v}"); },
        Result.Err(e) { print("Erro try_helper: ${e}"); }
    }
}

func test_retry_loop() {
    print("--- 3. Padrao Retry ---");
    let mut attempts = 0;
    let mut final_result = "";

    while attempts < 3 {
        attempts = attempts + 1;
        if (attempts < 3) {
            let data = fail_call("erro_temporario") catch err {
                print("Tentativa ${attempts} falhou com: ${err}");
                continue;
            };
            final_result = data;
            break;
        } else {
            let data = success_call() catch err {
                "fallback"
            };
            final_result = data;
            break;
        }
    }

    print("Resultado final retry: ${final_result}");
}

func main() {
    test_catch_basics();
    test_catch_with_propagation();
    test_retry_loop();
}

main();
