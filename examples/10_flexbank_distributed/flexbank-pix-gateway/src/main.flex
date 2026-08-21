// ============================================================================
// ⚡ FlexBank Pix Gateway Service (RFC-043)
// ============================================================================

import { Server, Request, Response } from "net/http";
import { IdempotencyEngine, IdempotencyConfig, CachedResponse } from "finance/idempotency";
import { CircuitBreaker, CircuitBreakerConfig } from "core/resilience";
import { Duration } from "core/time";
import { metrics, Counter } from "core/telemetry";
import { env } from "os/env";

func main() {
    let port = env.get_or("GATEWAY_PORT", "8082");

    let addr = ":${port}";
    let mut server = Server.new(addr);

    // 1. Motor de Idempotência e Circuit Breaker
    let idem_cfg = IdempotencyConfig {
        storage: "memory",
        ttl: Duration.seconds(300),
        header_name: "Idempotency-Key",
        lock_timeout: Duration.seconds(10),
    };
    let engine_res = IdempotencyEngine.new(idem_cfg);

    let cb_cfg = CircuitBreakerConfig {
        failure_threshold: 3,
        success_threshold: 2,
        timeout: Duration.seconds(10),
        half_open_max_requests: 1,
    };
    let breaker = CircuitBreaker.new("bacen_spi", cb_cfg);

    let pix_counter = metrics.counter("pix_gateway_requests_total", "Total de requisições processadas no Pix Gateway");

    // 2. Healthcheck
    server.get("/healthz", |req: Request, mut res: Response| {
        res.status(200).json({
            status: "ok",
            service: "flexbank-pix-gateway"
        });
    });

    // 3. Processamento Pix SPI com Idempotência
    server.post("/spi/process", |req: Request, mut res: Response| {
        pix_counter.inc();

        let mut idem_key = "";
        match req.header("idempotency-key") {
            Option.Some(k) {
                idem_key = k;
            },
            Option.None {
                res.error(400, "Idempotency-Key header obrigatório");
                return;
            }
        }

        match engine_res {
            Result.Ok(engine) {
                // 1. Verificação prévia no cache
                let check_res = engine.check(idem_key);
                match check_res {
                    Result.Ok(cached_opt) {
                        match cached_opt {
                            Option.Some(cached) {
                                res.status(cached.status).json(cached.body);
                                return;
                            },
                            Option.None {
                                // Não está no cache, prossegue
                            }
                        }
                    },
                    Result.Err(err_check) {
                        res.error(500, "Erro no check de idempotencia");
                        return;
                    }
                }

                // 2. Adquire lock atômico
                let lock_res = engine.start_processing(idem_key);
                match lock_res {
                    Result.Ok(lock) {
                        let response_payload = {
                            status: "PROCESSED",
                            spi_id: "spi_991823",
                            idempotency_key: idem_key
                        };
                        engine.save_completed(idem_key, 200, response_payload);
                        lock.release();
                        res.status(200).json(response_payload);
                    },
                    Result.Err(lock_err) {
                        res.error(409, "Requisicao ja em processamento");
                    }
                }
            },
            Result.Err(e) {
                res.error(500, "Idempotency engine indisponivel");
            }
        }
    });

    print("FlexBank Pix Gateway iniciado na porta ${port}");
    server.start();
}

main();
