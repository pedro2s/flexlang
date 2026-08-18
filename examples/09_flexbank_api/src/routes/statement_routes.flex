// Extrato Paginado com Métodos de Array e Closures (RFC-019, RFC-020, RFC-021)

import { Request, Response } from "net/http";
import { Transaction } from "../models/transaction";
import { get_account_transactions } from "../database/db";

func handle_statement(req: Request, mut res: Response) {
    let id = req.param("id");
    if (id == "") {
        res.status(400).json({ error: "ID da conta nao fornecido" });
        return;
    }

    let txs = get_account_transactions(id);
    let count = txs.len();

    let items = txs.map(|tx: Transaction| {
        return {
            id: tx.id,
            type: tx.type_name,
            amount: tx.amount,
            created_at: tx.created_at
        };
    });

    res.status(200).json({
        account_id: id,
        total_transactions: count.to_string(),
        transactions: items
    });
}
