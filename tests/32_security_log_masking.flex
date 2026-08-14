// parity: nondeterministic timestamps dinamicos nos logs
import { log } from "core/log";

// 1. Campos sensíveis com casing padrão e alternados
log.info("user login attempt", {
    user: "alice",
    password: "supersecret123",
    role: "engineer"
});

log.info("auth token generated", {
    service: "auth",
    Token: "jwt.token.value",
    api_key: "key_xyz_987",
    Authorization: "Bearer secret_bearer"
});

// 2. Erro com segredo e caixa alta
log.error("database connection failure", {
    host: "postgres.internal",
    PASSWORD: "root_db_password",
    secret: "production_master_secret"
});
