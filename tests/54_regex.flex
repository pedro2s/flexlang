// Teste RFC-044: Expressoes Regulares Nativas (std/regex)

import { regex, Regex } from "std/regex";

func main() {
    print("--- Running RFC-044 Regex Engine Test ---");

    // 1. Compilacao de expressao regular valida e validacao exata (matches)
    let cpf_res = regex.compile("^[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}$");
    match cpf_res {
        Result.Ok(cpf_pattern) {
            let valid = cpf_pattern.matches("123.456.789-00");
            let invalid = cpf_pattern.matches("12345678900");
            print(valid);
            print(invalid);
        },
        Result.Err(e) {
            print(e);
        }
    }

    // 2. Busca de padroes em texto longo com find (MatchResult)
    let log_text = "Transaction ID: e82f-41, Amount: 1500.50";
    let uuid_res = regex.compile("[a-f0-9]{4}-[a-f0-9]{2}");
    match uuid_res {
        Result.Ok(uuid_pattern) {
            match uuid_pattern.find(log_text) {
                Option.Some(m) {
                    print("Found match:");
                    print(m.text);
                    print(m.start);
                    print(m.end);
                },
                Option.None {
                    print("Match not found");
                }
            }
        },
        Result.Err(e) {
            print(e);
        }
    }

    // 3. Substituicao global (replace_all)
    let spaces_res = regex.compile("\\s+");
    match spaces_res {
        Result.Ok(spaces) {
            let clean_str = spaces.replace_all("Muitos     espacos   aqui  na  string", " ");
            print(clean_str);
        },
        Result.Err(e) {
            print(e);
        }
    }

    // 4. Divisao de texto com split
    let split_res = regex.compile("[,;\\s]+");
    match split_res {
        Result.Ok(delim) {
            let tokens = delim.split("laranja,banana;uva maca   morango");
            print("Split tokens count:");
            print(tokens.len());
            for item in tokens {
                print(item);
            }
        },
        Result.Err(e) {
            print(e);
        }
    }

    // 5. Metodo utilitario direto is_match
    let is_alpha = regex.is_match("^[a-zA-Z]+$", "FlexLang");
    match is_alpha {
        Result.Ok(v) {
            print("is_match alpha:");
            print(v);
        },
        Result.Err(e) {
            print(e);
        }
    }

    // 6. Tratamento de erro em regex invalida
    let bad_regex = regex.compile("[a-z");
    match bad_regex {
        Result.Ok(r) {
            print("Error: bad regex should fail compilation");
        },
        Result.Err(err_msg) {
            print("Bad regex safely caught:");
            print(err_msg.contains("regex"));
        }
    }

    print("RFC-044 Regex Engine verified successfully!");
}

main();
