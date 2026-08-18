// Rotas de Transferências e Simulação de Investimentos (RFC-025, RFC-029)

import { Request, Response } from "net/http";
import { TransferRequest, SimulateInvestmentRequest } from "../models/transaction";
import { process_transfer } from "../services/transfer_service";
import { simulate_compound_interest } from "../services/interest_service";

func parse_transfer_input(req: Request) -> Result<TransferRequest, String> {
    let body: TransferRequest = req.json()?;
    return Result.Ok(body);
}

func parse_simulate_input(req: Request) -> Result<SimulateInvestmentRequest, String> {
    let body: SimulateInvestmentRequest = req.json()?;
    return Result.Ok(body);
}

func handle_transfer(req: Request, mut res: Response) {
    match parse_transfer_input(req) {
        Result.Ok(body) {
            if (body.source_id == "" || body.target_id == "" || body.amount == "") {
                res.status(400).json({ error: "source_id, target_id e amount sao obrigatorios" });
                return;
            }

            let tx_id = process_transfer(body.source_id, body.target_id, body.amount) catch err {
                res.status(422).json({ error: err });
                return;
            };

            res.status(201).json({
                transaction_id: tx_id,
                status: "COMPLETED",
                amount: body.amount
            });
        },
        Result.Err(err) {
            res.status(400).json({ error: "Corpo JSON invalido: ${err}" });
        }
    }
}

func handle_simulate_investment(req: Request, mut res: Response) {
    match parse_simulate_input(req) {
        Result.Ok(body) {
            let months = parse_int(body.months) catch err {
                12
            };

            let total = simulate_compound_interest(body.principal, body.monthly_rate, months) catch err {
                res.status(400).json({ error: "Erro calculando juros: ${err}" });
                return;
            };

            res.status(200).json({
                principal: body.principal,
                monthly_rate: body.monthly_rate,
                months: months.to_string(),
                total_amount: total
            });
        },
        Result.Err(err) {
            res.status(400).json({ error: "Corpo JSON invalido: ${err}" });
        }
    }
}
