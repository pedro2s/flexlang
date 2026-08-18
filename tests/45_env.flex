// Teste RFC-026: Módulo os/env - Variáveis de Ambiente e Configuração

import { env } from "os/env";

func test_env() {
    print("--- Teste os/env ---");

    // Variável inexistente com get
    let missing = env.get("NON_EXISTENT_VAR_12345");
    match missing {
        Option.Some(val) {
            print("Encontrou: ${val}");
        },
        Option.None {
            print("Variavel ausente retornou None como esperado");
        }
    }

    // Variável inexistente com get_or (fallback)
    let port = env.get_or("CUSTOM_PORT", "8080");
    print("Porta configurada: ${port}");

    // Checagem de existência com has
    let has_fake = env.has("NON_EXISTENT_VAR_12345");
    print("Tem fake var: ${has_fake}");

    // Variável existente padrão (ex: PATH)
    let has_path = env.has("PATH");
    print("Tem PATH: ${has_path}");

    let path_val = env.get_or("PATH", "padrao");
    let is_not_default = path_val != "padrao";
    print("PATH customizado: ${is_not_default}");

    let path_req = env.require("PATH");
    let req_ok = path_req != "";
    print("Require PATH ok: ${req_ok}");
}

func main() {
    test_env();
}

main();
