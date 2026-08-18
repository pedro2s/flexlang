// Teste RFC-017: else if, break e continue

func classificar_nota(nota: Int) {
    if nota >= 90 {
        print("Nota A: Excelente");
    } else if nota >= 80 {
        print("Nota B: Bom");
    } else if nota >= 70 {
        print("Nota C: Regular");
    } else {
        print("Nota F: Reprovado");
    }
}

func test_else_if() {
    print("--- Teste Else If ---");
    classificar_nota(95);
    classificar_nota(85);
    classificar_nota(72);
    classificar_nota(40);
}

func test_for_break() {
    print("--- Teste For Break ---");
    for i in 0..10 {
        if i == 4 {
            break;
        }
        print("For loop: ${i}");
    }
}

func test_for_continue() {
    print("--- Teste For Continue ---");
    for i in 0..5 {
        if i == 2 {
            continue;
        }
        print("For continue: ${i}");
    }
}

func test_while_control() {
    print("--- Teste While Break e Continue ---");
    let mut contador = 0;
    while contador < 8 {
        contador = contador + 1;
        if contador == 2 {
            continue;
        }
        if contador == 6 {
            break;
        }
        print("While val: ${contador}");
    }
}

func main() {
    test_else_if();
    test_for_break();
    test_for_continue();
    test_while_control();
}

main();
