// Modelos de Conta (RFC-030)

import { Auditable } from "../traits/auditable";

struct Account {
    id: String,
    holder: String,
    cpf: String,
    email: String,
    balance: String,
    status: String
}

impl Auditable for Account {
    func get_entity_id() -> String {
        return self.id;
    }
}

struct UpdateAccountRequest {
    holder: String,
    email: String
}
