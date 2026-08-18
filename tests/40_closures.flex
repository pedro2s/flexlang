// Teste RFC-021: Closures com Captura de Escopo

func test_basic_capture() {
    print("--- Teste Captura Basica ---");
    let prefix = "Item";
    let format = |id: Int| {
        return "${prefix} #${id}";
    };
    print(format(1));
    print(format(2));
}

func test_mutable_capture() {
    print("--- Teste Captura Mutavel ---");
    let mut contador = 0;
    let incrementa = || {
        contador = contador + 1;
    };
    incrementa();
    incrementa();
    incrementa();
    print("Contador final: ${contador}");
}

func test_higher_order_with_capture() {
    print("--- Teste Captura em Metodos de Alta Ordem ---");
    let threshold = 15;
    let valores = [10, 25, 5, 30, 12, 18];

    let filtrados = valores.filter(|x| {
        return x > threshold;
    });
    for f in filtrados {
        print("Acima de ${threshold}: ${f}");
    }

    let mut soma = 0;
    filtrados.for_each(|x| {
        soma = soma + x;
    });
    print("Soma dos filtrados: ${soma}");
}

func test_nested_closures() {
    print("--- Teste Closures Aninhadas ---");
    let base = 100;
    let nivel1 = |a: Int| {
        let nivel2 = |b: Int| {
            return base + a + b;
        };
        return nivel2(20);
    };

    print("Resultado aninhado: ${nivel1(5)}");
}

func main() {
    test_basic_capture();
    test_mutable_capture();
    test_higher_order_with_capture();
    test_nested_closures();
}

main();
