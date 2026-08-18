// ============================================================================
// 🏦 FLEXBANK API - Core Banking Backend em FlexLang v0.3.0
// ============================================================================

import { Server, ServerConfig, CorsConfig } from "net/http";
import { log } from "core/log";
import { init_database } from "./database/db";
import { get_server_port, get_app_env } from "./config/settings";
import { correlation_middleware } from "./middlewares/auth";
import { handle_register, handle_login } from "./routes/auth_routes";
import {
    handle_get_account,
    handle_get_balance,
    handle_update_account,
    handle_close_account
} from "./routes/account_routes";
import { handle_transfer, handle_simulate_investment } from "./routes/transfer_routes";
import { handle_statement } from "./routes/statement_routes";

// 1. Inicializa banco de dados
init_database();

// 2. Configura porta e servidor
let port = get_server_port();
let mut server = Server.new(":${port}", ServerConfig {
    read_timeout: 5000,
    max_body_size: 2000000
});

// 3. CORS
server.cors(CorsConfig {
    allow_origins: ["https://flexbank.com.br", "http://localhost:3000"],
    allow_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers: ["Authorization", "Content-Type", "X-Correlation-ID"],
    max_age: 86400
});

// 4. Middlewares globais
server.use(correlation_middleware);

// 5. Rotas de Autenticação
server.post("/auth/register", handle_register);
server.post("/auth/login", handle_login);

// 6. Rotas de Gestão de Contas
server.get("/accounts/:id", handle_get_account);
server.get("/accounts/:id/balance", handle_get_balance);
server.put("/accounts/:id", handle_update_account);
server.delete("/accounts/:id", handle_close_account);

// 7. Rotas de Transações e Investimentos
server.post("/transfers", handle_transfer);
server.post("/investments/simulate", handle_simulate_investment);
server.get("/accounts/:id/statement", handle_statement);

log.info("FlexBank API inicializado", {
    port: port,
    env: get_app_env()
});

server.start();
