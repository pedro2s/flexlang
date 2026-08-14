// Teste 27: Sistema de Modulos Locais (Multi-arquivo - RFC-006)

import { User } from "./modules/user";
import { find_user } from "./modules/user_repo";

let res1 = find_user(1);
match res1 {
    Result.Ok(u) => {
        print(u.name);
        print(u.greeting());
    },
    Result.Err(e) => {
        print("Erro: ${e}");
    }
}

let res2 = find_user(99);
match res2 {
    Result.Ok(u) => {
        print(u.name);
    },
    Result.Err(e) => {
        print("Erro esperado: ${e}");
    }
}
