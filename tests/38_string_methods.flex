// Teste RFC-019: Métodos de String

func test_basic_transforms() {
    print("--- Teste Transformacoes Basicas ---");
    let txt = "  FlexLang eh Incrivel!  ";
    let l = txt.len();
    let tr = txt.trim();
    let up = txt.trim().to_upper();
    let lo = txt.trim().to_lower();
    print("Original: '${txt}'");
    print("Len: ${l}");
    print("Trim: '${tr}'");
    print("Upper: '${up}'");
    print("Lower: '${lo}'");

    let utf8_txt = "Ação";
    let utf8_len = utf8_txt.len();
    print("UTF-8 Len: ${utf8_len}");
}

func test_predicates() {
    print("--- Teste Predicados ---");
    let email = "admin@flexlang.dev";
    let has_at = email.contains("@");
    let has_hash = email.contains("#");
    let starts_admin = email.starts_with("admin");
    let starts_user = email.starts_with("user");
    let ends_dev = email.ends_with(".dev");
    let ends_com = email.ends_with(".com");

    print("Contains @: ${has_at}");
    print("Contains #: ${has_hash}");
    print("Starts with admin: ${starts_admin}");
    print("Starts with user: ${starts_user}");
    print("Ends with .dev: ${ends_dev}");
    print("Ends with .com: ${ends_com}");
}

func test_split_and_replace() {
    print("--- Teste Split e Replace ---");
    let csv = "apple,banana,orange";
    let fruits = csv.split(",");
    for f in fruits {
        print("Fruta: ${f}");
    }

    let cpf = "123.456.789-00";
    let cpf_clean = cpf.replace(".", "").replace("-", "");
    print("CPF Limpo: ${cpf_clean}");
}

func test_substring_and_index_of() {
    print("--- Teste Substring e IndexOf ---");
    let palavra = "FlexLang";
    let sub1 = palavra.substring(0, 4);
    let sub2 = palavra.substring(4, 8);
    print("Sub 0..4: ${sub1}");
    print("Sub 4..8: ${sub2}");

    let msg = "suporte@flex.org";
    match msg.index_of("@") {
        Option.Some(idx) {
            print("Arroba em: ${idx}");
        },
        Option.None {
            print("Arroba nao encontrado");
        }
    }

    match msg.index_of("xyz") {
        Option.Some(idx) {
            print("xyz em: ${idx}");
        },
        Option.None {
            print("xyz nao encontrado");
        }
    }
}

func main() {
    test_basic_transforms();
    test_predicates();
    test_split_and_replace();
    test_substring_and_index_of();
}

main();
