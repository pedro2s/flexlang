// Conexão e Gerenciamento de Persistência com PostgreSQL

import { Pool } from "db/postgres";
import { log } from "core/log";

func init_database() {
    log.info("Inicializando conexao com o banco de dados do Le Salvi", {
        host: "postgres.internal",
        database: "lesalvi_db",
        pool_size: 10
    });

    match Pool.connect("postgres://postgres:secret@localhost:5432/lesalvi_db") {
        Result.Ok(pool) {
            log.info("Pool PostgreSQL conectado com sucesso", { status: "ready" });
        },
        Result.Err(err) {
            log.error("PostgreSQL indisponivel em modo offline - operando com store in-memory", {
                fallback: "in-memory-storage"
            });
        }
    }
}
