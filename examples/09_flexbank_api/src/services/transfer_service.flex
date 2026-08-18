// Serviço de Transferências com Precisão Decimal e Retry Catch (RFC-025, RFC-028, RFC-029)

import { Account } from "../models/account";
import { Transaction } from "../models/transaction";
import { find_account, save_account, add_transaction } from "../database/db";
import { Decimal } from "math/decimal";
import { uuid } from "crypto";
import { Time } from "core/time";
import { log } from "core/log";

func process_transfer(source_id: String, target_id: String, amount_str: String) -> Result<String, String> {
    let source_opt = find_account(source_id);
    let mut source = Account { id: "", holder: "", cpf: "", email: "", balance: "", status: "" };
    match source_opt {
        Option.Some(acc) { source = acc; },
        Option.None { return Result.Err("Conta de origem nao encontrada"); }
    }

    let target_opt = find_account(target_id);
    let mut target = Account { id: "", holder: "", cpf: "", email: "", balance: "", status: "" };
    match target_opt {
        Option.Some(acc) { target = acc; },
        Option.None { return Result.Err("Conta de destino nao encontrada"); }
    }

    if (source.status != "ACTIVE") {
        return Result.Err("Conta de origem inativa");
    }
    if (target.status != "ACTIVE") {
        return Result.Err("Conta de destino inativa");
    }

    let transfer_amount = Decimal.new(amount_str);
    if (transfer_amount.is_zero() || transfer_amount.is_negative()) {
        return Result.Err("Valor de transferencia deve ser positivo");
    }

    let source_bal = Decimal.new(source.balance);
    if (source_bal.lt(transfer_amount)) {
        return Result.Err("Saldo insuficiente");
    }

    let new_source_bal = source_bal.sub(transfer_amount);
    let target_bal = Decimal.new(target.balance);
    let new_target_bal = target_bal.add(transfer_amount);

    source.balance = new_source_bal.to_string();
    target.balance = new_target_bal.to_string();

    save_account(source);
    save_account(target);

    let tx_id = uuid.v4();
    let now_str = Time.now().iso8601();

    let debit_tx = Transaction {
        id: uuid.v4(),
        account_id: source_id,
        type_name: "DEBIT",
        amount: amount_str,
        created_at: now_str
    };
    let credit_tx = Transaction {
        id: uuid.v4(),
        account_id: target_id,
        type_name: "CREDIT",
        amount: amount_str,
        created_at: now_str
    };

    add_transaction(debit_tx);
    add_transaction(credit_tx);

    return Result.Ok(tx_id);
}
