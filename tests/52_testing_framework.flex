// Teste RFC-041: Framework Nativo de Testes Unitários (std/testing e #[test])

import { testing } from "std/testing";

#[test]
func test_basic_assertions() {
    testing.assert_true(1 == 1, "A matematica basica falhou");
    testing.assert_false(1 == 2, "Um nao deve ser dois");
    testing.assert_eq("FlexLang", "FlexLang", "Strings devem ser iguais");
    testing.assert_neq(42, 0, "Valores nao podem coincidir");
    print("Basic assertions passed");
}

#[test]
func test_result_and_option_assertions() {
    let res = Result.Ok(100);
    let val = testing.assert_ok(res, "Deveria retornar Ok");
    testing.assert_eq(val, 100, "Valor do Result.Ok coincide");

    let err = Result.Err("Falha de Rede");
    let err_msg = testing.assert_err(err, "Deveria falhar");
    testing.assert_eq(err_msg, "Falha de Rede", "Mensagem de erro coincide");

    let opt = Option.Some(true);
    let opt_val = testing.assert_some(opt, "Nao pode ser None");
    testing.assert_true(opt_val, "Valor da Option coincide");

    testing.assert_none(Option.None, "Deve ser None");
    print("Result and Option assertions passed");
}

func main() {
    print("--- Running RFC-041 Testing Framework ---");
    test_basic_assertions();
    test_result_and_option_assertions();
    print("All unit tests passed successfully!");
}

main();
