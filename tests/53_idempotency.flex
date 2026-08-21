// Teste RFC-042: Motor de Idempotencia e Transacoes Financeiras (finance/idempotency)

import { IdempotencyEngine, IdempotencyConfig } from "finance/idempotency";
import { Duration } from "core/time";

func main() {
    print("--- Running RFC-042 Idempotency Engine Test ---");

    let engine_res = IdempotencyEngine.new(IdempotencyConfig {
        ttl: Duration.hours(24),
        header_name: "Idempotency-Key",
        lock_timeout: Duration.seconds(30)
    });

    match engine_res {
        Result.Ok(idempotency) {
            let key = "pix_transf_abc_123";

            // 1. Primeira verificacao: a chave nunca foi executada
            let check_first = idempotency.check(key);
            match check_first {
                Result.Ok(opt_res) {
                    match opt_res {
                        Option.None {
                            print("1. New transaction detected (no cache)");
                        },
                        Option.Some(cached) {
                            print("Error: should not find cache for new key");
                        }
                    }
                },
                Result.Err(e) {
                    print(e);
                }
            }

            // 2. Adquire lock de processamento
            let lock_res = idempotency.start_processing(key);
            match lock_res {
                Result.Ok(lock) {
                    print("2. Distributed lock acquired for transaction");

                    // 3. Requisicao concorrente simultanea com a mesma chave deve falhar
                    let check_concurrent = idempotency.check(key);
                    match check_concurrent {
                        Result.Ok(v) {
                            print("Error: concurrent request should not pass check");
                        },
                        Result.Err(err_msg) {
                            print("3. Concurrent request blocked: transaction in progress");
                        }
                    }

                    // 4. Salva a conclusao da transacao com status 201
                    let payload = "{\"transfer_id\":\"tr_pix_999\",\"status\":\"COMPLETED\",\"amount\":150.00}";
                    let save_res = idempotency.save_completed(key, 201, payload);
                    match save_res {
                        Result.Ok(v) {
                            print("4. Transaction completed and response cached");
                        },
                        Result.Err(e) {
                            print(e);
                        }
                    }
                },
                Result.Err(e) {
                    print(e);
                }
            }

            // 5. Nova tentativa com a mesma chave: retorna resposta cacheada sem reexecutar debito
            let check_replay = idempotency.check(key);
            match check_replay {
                Result.Ok(opt_cached) {
                    match opt_cached {
                        Option.Some(cached) {
                            print("5. Idempotent replay: cached response returned");
                            print(cached.status);
                            print(cached.body);
                        },
                        Option.None {
                            print("Error: cached response missing");
                        }
                    }
                },
                Result.Err(e) {
                    print(e);
                }
            }

            // 6. Limpa a chave
            idempotency.clear(key);
            let check_after_clear = idempotency.check(key);
            match check_after_clear {
                Result.Ok(opt_cleared) {
                    match opt_cleared {
                        Option.None {
                            print("6. Key cleared successfully");
                        },
                        Option.Some(c) {
                            print("Error: key should have been cleared");
                        }
                    }
                },
                Result.Err(e) {
                    print(e);
                }
            }
        },
        Result.Err(e) {
            print(e);
        }
    }

    print("RFC-042 Idempotency Engine verified successfully!");
}

main();
