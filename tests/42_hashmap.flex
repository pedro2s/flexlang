// Teste RFC-023: HashMap<K, V> Tipado

func test_hashmap_basic() {
    print("--- Teste HashMap Basico ---");
    let mut mapa: HashMap<String, Int> = HashMap.new();
    print("Vazio: ${mapa.is_empty()}");
    print("Len inicial: ${mapa.len()}");

    mapa.set("Alice", 100);
    mapa.set("Bob", 200);
    let len_apos_set = mapa.len();
    let vazio_apos_set = mapa.is_empty();
    let has_alice = mapa.contains_key("Alice");
    let has_charlie = mapa.contains_key("Charlie");
    print("Len apos sets: ${len_apos_set}");
    print("Vazio apos sets: ${vazio_apos_set}");
    print("Contains Alice: ${has_alice}");
    print("Contains Charlie: ${has_charlie}");

    match mapa.get("Alice") {
        Option.Some(saldo) {
            print("Get Alice: ${saldo}");
        },
        Option.None {
            print("Get Alice falhou");
        }
    }

    match mapa.get("Charlie") {
        Option.Some(saldo) {
            print("Get Charlie: ${saldo}");
        },
        Option.None {
            print("Get Charlie: nao encontrado com sucesso");
        }
    }

    match mapa.remove("Alice") {
        Option.Some(removido) {
            print("Remove Alice: ${removido}");
        },
        Option.None {
            print("Remove Alice falhou");
        }
    }

    let len_apos_remove = mapa.len();
    let has_alice_depois = mapa.contains_key("Alice");
    print("Len apos remove: ${len_apos_remove}");
    print("Contains Alice apos remove: ${has_alice_depois}");

    match mapa.remove("Alice") {
        Option.Some(removido) {
            print("Remove Alice repetido falhou");
        },
        Option.None {
            print("Remove Alice repetido devolveu None com sucesso");
        }
    }
}

func test_hashmap_from() {
    print("--- Teste HashMap.from ---");
    let config = HashMap.from({
        "host": "localhost",
        "porta": "8080"
    });

    print("Config len: ${config.len()}");
    match config.get("host") {
        Option.Some(h) {
            print("Host: ${h}");
        },
        Option.None {
            print("Host nao encontrado");
        }
    }
}

func test_hashmap_keys_values() {
    print("--- Teste Keys e Values ---");
    let mut m: HashMap<String, Int> = HashMap.new();
    m.set("k1", 1);
    let chaves = m.keys();
    let valores = m.values();
    print("Keys len: ${chaves.len()}");
    print("Values len: ${valores.len()}");
    print("Chave 0: ${chaves[0]}");
    print("Valor 0: ${valores[0]}");
}

func main() {
    test_hashmap_basic();
    test_hashmap_from();
    test_hashmap_keys_values();
}

main();
