// Rotas de Autenticação (RFC-027, RFC-028)

import { Request, Response } from "net/http";
import { User, SessionToken, RegisterRequest, LoginRequest } from "../models/auth";
import { Account } from "../models/account";
import { find_user_by_email, save_user, save_account, save_session } from "../database/db";
import { hash, uuid } from "crypto";
import { Time, Duration } from "core/time";

func parse_register_input(req: Request) -> Result<RegisterRequest, String> {
    let body: RegisterRequest = req.json()?;
    return Result.Ok(body);
}

func parse_login_input(req: Request) -> Result<LoginRequest, String> {
    let body: LoginRequest = req.json()?;
    return Result.Ok(body);
}

func handle_register(req: Request, mut res: Response) {
    match parse_register_input(req) {
        Result.Ok(body) {
            if (body.name == "" || body.email == "" || body.password == "") {
                res.status(400).json({ error: "Campos obrigatorios ausentes" });
                return;
            }

            let existing = find_user_by_email(body.email);
            match existing {
                Option.Some(u) {
                    res.status(409).json({ error: "Usuario ja cadastrado" });
                    return;
                },
                Option.None {}
            }

            let pass_res = hash.bcrypt(body.password);
            let mut pass_hash = "";
            match pass_res {
                Result.Ok(h) { pass_hash = h; },
                Result.Err(e) {
                    res.status(500).json({ error: "Erro gerando hash de senha" });
                    return;
                }
            }

            let user_id = uuid.v4();
            let new_user = User {
                id: user_id,
                name: body.name,
                email: body.email,
                password_hash: pass_hash
            };
            save_user(new_user);

            let acc_id = "acc_${user_id.substring(0, 8)}";
            let new_acc = Account {
                id: acc_id,
                holder: body.name,
                cpf: body.cpf,
                email: body.email,
                balance: "0.00",
                status: "ACTIVE"
            };
            save_account(new_acc);

            res.status(201).json({
                id: user_id,
                account_id: acc_id,
                name: body.name,
                email: body.email
            });
        },
        Result.Err(err) {
            res.status(400).json({ error: "Corpo JSON invalido: ${err}" });
        }
    }
}

func handle_login(req: Request, mut res: Response) {
    match parse_login_input(req) {
        Result.Ok(body) {
            let user_opt = find_user_by_email(body.email);
            let mut user = User { id: "", name: "", email: "", password_hash: "" };
            match user_opt {
                Option.Some(u) { user = u; },
                Option.None {
                    res.status(401).json({ error: "Credenciais invalidas" });
                    return;
                }
            }

            let is_valid = hash.bcrypt_verify(body.password, user.password_hash);
            if (!is_valid) {
                res.status(401).json({ error: "Credenciais invalidas" });
                return;
            }

            let token_val = uuid.v4();
            let expires = Time.now().add_duration(Duration.hours(2)).iso8601();
            let session = SessionToken {
                token: token_val,
                user_id: user.id,
                expires_at: expires
            };
            save_session(session);

            res.status(200).json({
                token: token_val,
                user_id: user.id,
                expires_at: expires
            });
        },
        Result.Err(err) {
            res.status(400).json({ error: "Corpo JSON invalido: ${err}" });
        }
    }
}
