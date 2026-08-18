// Rotas de Contas (RFC-022, RFC-025)

import { Request, Response } from "net/http";
import { Account, UpdateAccountRequest } from "../models/account";
import { find_account, save_account } from "../database/db";

func parse_update_input(req: Request) -> Result<UpdateAccountRequest, String> {
    let body: UpdateAccountRequest = req.json()?;
    return Result.Ok(body);
}

func handle_get_account(req: Request, mut res: Response) {
    let id = req.param("id");
    if (id == "") {
        res.status(400).json({ error: "ID da conta nao fornecido" });
        return;
    }

    let acc_opt = find_account(id);
    match acc_opt {
        Option.Some(acc) {
            res.status(200).json({
                id: acc.id,
                holder: acc.holder,
                cpf: acc.cpf,
                email: acc.email,
                balance: acc.balance,
                status: acc.status
            });
        },
        Option.None {
            res.status(404).json({ error: "Conta nao encontrada" });
        }
    }
}

func handle_get_balance(req: Request, mut res: Response) {
    let id = req.param("id");
    if (id == "") {
        res.status(400).json({ error: "ID da conta nao fornecido" });
        return;
    }

    let acc_opt = find_account(id);
    match acc_opt {
        Option.Some(acc) {
            res.status(200).json({
                account_id: acc.id,
                balance: acc.balance
            });
        },
        Option.None {
            res.status(404).json({ error: "Conta nao encontrada" });
        }
    }
}

func handle_update_account(req: Request, mut res: Response) {
    let id = req.param("id");
    if (id == "") {
        res.status(400).json({ error: "ID da conta nao fornecido" });
        return;
    }

    let acc_opt = find_account(id);
    let mut acc = Account { id: "", holder: "", cpf: "", email: "", balance: "", status: "" };
    match acc_opt {
        Option.Some(a) { acc = a; },
        Option.None {
            res.status(404).json({ error: "Conta nao encontrada" });
            return;
        }
    }

    match parse_update_input(req) {
        Result.Ok(body) {
            if (body.holder != "") {
                acc.holder = body.holder;
            }
            if (body.email != "") {
                acc.email = body.email;
            }

            save_account(acc);
            res.status(200).json({
                id: acc.id,
                holder: acc.holder,
                cpf: acc.cpf,
                email: acc.email,
                balance: acc.balance,
                status: acc.status
            });
        },
        Result.Err(err) {
            res.status(400).json({ error: "Corpo JSON invalido: ${err}" });
        }
    }
}

func handle_close_account(req: Request, mut res: Response) {
    let id = req.param("id");
    if (id == "") {
        res.status(400).json({ error: "ID da conta nao fornecido" });
        return;
    }

    let acc_opt = find_account(id);
    let mut acc = Account { id: "", holder: "", cpf: "", email: "", balance: "", status: "" };
    match acc_opt {
        Option.Some(a) { acc = a; },
        Option.None {
            res.status(404).json({ error: "Conta nao encontrada" });
            return;
        }
    }

    acc.status = "CLOSED";
    save_account(acc);

    res.status(200).json({
        id: acc.id,
        status: "CLOSED"
    });
}
