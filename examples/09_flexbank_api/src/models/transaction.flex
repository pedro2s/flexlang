// Modelos de Transação (RFC-030)

import { Auditable } from "../traits/auditable";

struct Transaction {
    id: String,
    account_id: String,
    type_name: String,
    amount: String,
    created_at: String
}

impl Auditable for Transaction {
    func get_entity_id() -> String {
        return self.id;
    }
}

struct TransferRequest {
    source_id: String,
    target_id: String,
    amount: String
}

struct SimulateInvestmentRequest {
    principal: String,
    monthly_rate: String,
    months: String
}
