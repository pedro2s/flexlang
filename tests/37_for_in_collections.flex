// Teste RFC-018: for item in collection (Arrays, Maps, Ranges e Índices)

func test_array_for_in() {
    print("--- Teste Array For In ---");
    let numeros = [10, 20, 30];
    for n in numeros {
        print("Num: ${n}");
    }
}

func test_array_with_index() {
    print("--- Teste Array com Indice ---");
    let nomes = ["Alice", "Bob", "Charlie"];
    for nome, idx in nomes {
        print("${idx}: ${nome}");
    }
}

func test_range_regression() {
    print("--- Teste Range Regression ---");
    for i in 1..4 {
        print("Range: ${i}");
    }
}

func test_map_for_in() {
    print("--- Teste Map For In ---");
    let config = { "ambiente": "producao" };
    for k, v in config {
        print("Config ${k}: ${v}");
    }
}

func test_for_in_control_flow() {
    print("--- Teste For In com Break e Continue ---");
    let linguagens = ["C", "Rust", "Go", "FlexLang", "Python"];
    for lang, pos in linguagens {
        if lang == "Rust" {
            continue;
        }
        if lang == "Python" {
            break;
        }
        print("Item ${pos}: ${lang}");
    }
}

func main() {
    test_array_for_in();
    test_array_with_index();
    test_range_regression();
    test_map_for_in();
    test_for_in_control_flow();
}

main();
