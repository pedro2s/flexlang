// FlexLang: Arquitetura Modular Multi-arquivo (RFC-006)
// Demonstra organização limpa em camadas (models, repository, services) com imports locais.

import { User } from "./models/user";
import { find_user_by_id } from "./repository/user_repository";
import { promote_user_to_admin } from "./services/user_service";

print("=============================================================");
print("🏢 FlexLang Enterprise: Arquitetura Multi-arquivo Modular");
print("=============================================================");

// 1. Consultar usuário existente e invocar método da struct
print("");
print("--- 1. Consultando Usuario na Camada de Dados ---");
match find_user_by_id(1) {
    Option.Some(u) {
        print(u.display_info());
    },
    Option.None {
        print("Usuario nao localizado.");
    }
}

// 2. Executar Regra de Negócio (Promover Bob a Admin)
print("");
print("--- 2. Executando Promocao de Cargo no Servico ---");
match promote_user_to_admin(2) {
    Result.Ok(msg) {
        print("Sucesso: ${msg}");
    },
    Result.Err(err) {
        print("Falha: ${err}");
    }
}

// 3. Tentar Promover Alice que já é Admin
print("");
print("--- 3. Tentando Promover Usuario que ja e Admin ---");
match promote_user_to_admin(1) {
    Result.Ok(msg) {
        print("Sucesso: ${msg}");
    },
    Result.Err(err) {
        print("Regra de Negocio bloqueou: ${err}");
    }
}

// 4. Tentar Promover Usuário Inexistente
print("");
print("--- 4. Tentando Promover Usuario Inexistente ---");
match promote_user_to_admin(99) {
    Result.Ok(msg) {
        print("Sucesso: ${msg}");
    },
    Result.Err(err) {
        print("Erro de Validacao: ${err}");
    }
}
