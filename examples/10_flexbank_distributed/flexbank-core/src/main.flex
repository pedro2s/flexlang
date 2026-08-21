// ============================================================================
// 🏦 FlexBank Core Banking Service (RFC-043)
// ============================================================================

import { Server, Request, Response } from "net/http";
import { jwt } from "crypto/jwt";
import { Decimal } from "math/decimal";
import { regex, Regex } from "std/regex";
import { tracer, Span } from "core/telemetry";
import { Producer, KafkaConfig, EventMessage } from "mq/kafka";
import { env } from "os/env";

func main() {
    let port = env.get_or("CORE_PORT", "8081");
    let jwt_secret = env.get_or("JWT_SECRET", "flexbank_master_secret_key_2026");

    let addr = ":${port}";
    let mut server = Server.new(addr);

    // 1. Healthcheck
    server.get("/healthz", |req: Request, mut res: Response| {
        res.status(200).json({
            status: "ok",
            service: "flexbank-core"
        });
    });

    // 2. Login e Geração JWT
    server.post("/auth/login", |req: Request, mut res: Response| {
        let claims = {
            sub: "usr_alice",
            iss: "flexbank-issuer"
        };
        let opts = {
            secret: jwt_secret,
            expires_in: 3600
        };

        let token_res = jwt.sign(claims, opts);
        match token_res {
            Result.Ok(token) {
                res.status(200).json({
                    token: token,
                    user: "usr_alice"
                });
            },
            Result.Err(err) {
                res.error(500, "Falha ao gerar JWT");
            }
        }
    });

    // 3. Transferência Pix
    server.post("/pix/transfer", |req: Request, mut res: Response| {
        match req.header("authorization") {
            Option.Some(auth_header) {
                // Header presente
            },
            Option.None {
                res.error(401, "Authorization header obrigatório");
                return;
            }
        }

        // Validação da chave Pix com Regex
        let email_pattern = regex.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
        match email_pattern {
            Result.Ok(re) {
                let is_valid_key = re.matches("pix.destino@flexbank.dev");
                if (!is_valid_key) {
                    res.error(400, "Chave Pix inválida");
                    return;
                }
            },
            Result.Err(e) {
                res.error(500, "Erro na compilação de regex");
                return;
            }
        }

        // Ledger Decimal de alta precisão
        let saldo_inicial = Decimal.new("1500.50");
        let valor_pix = Decimal.new("250.00");
        let novo_saldo = saldo_inicial.sub(valor_pix);

        // Telemetria com Span
        let span = tracer.start_span("core_pix_transfer");
        span.set_tag("account.id", "acc_alice_101");
        span.set_tag("pix.amount", valor_pix.to_string());
        span.finish();

        // Emissão do evento de liquidação via Producer
        let prod_cfg = KafkaConfig {
            brokers: ["localhost:9092"],
            client_id: "core-producer",
            acks: "all"
        };
        let prod_res = Producer.new(prod_cfg);
        match prod_res {
            Result.Ok(producer) {
                let msg = EventMessage {
                    key: "acc_alice_101",
                    value: "{\"tx_id\":\"tx_pix_991\",\"amount\":\"250.00\",\"payer\":\"acc_alice_101\",\"payee\":\"acc_bob_202\"}",
                    headers: {}
                };
                producer.publish("pix.settled", msg);
            },
            Result.Err(e) {
                print("Aviso: Producer em fallback local");
            }
        }

        let valor_str = valor_pix.to_string();
        let saldo_str = novo_saldo.to_string();
        res.status(200).json({
            status: "SETTLED",
            tx_id: "tx_pix_991",
            amount: valor_str,
            balance: saldo_str
        });
    });

    print("FlexBank Core iniciado na porta ${port}");
    server.start();
}

main();
