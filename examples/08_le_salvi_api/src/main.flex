// ============================================================================
// 💇‍♀️ LE SALVI - Plataforma de Estética e Beleza (API Backend em FlexLang)
// Demonstração ponta-a-ponta dos recursos da FlexLang v0.2.0:
// - Servidor HTTP nativo com despacho por verbo (GET, POST, PUT, PATCH, DELETE)
// - Configuração de CORS com Preflight automático e cabeçalhos de segurança
// - Cadeia global de Middlewares e controle de fluxo por resposta
// - Leitura case-insensitive de headers e injeção de headers customizados
// - Tratamento seguro de panic (500 por request sem derrubar o servidor)
// - Health check nativo (/healthz) isento de autenticação
// - Logs estruturados com mascaramento automático de campos sensíveis
// - Abstrações de domínio com Structs, Enums, Traits e Pattern Matching
// ============================================================================

import { Server, ServerConfig, CorsConfig } from "net/http";
import { log } from "core/log";
import { init_database } from "./database/db";
import { logging_middleware, auth_middleware } from "./middlewares/auth";
import { handle_login } from "./routes/auth_routes";
import { handle_list_services, handle_get_service } from "./routes/services_routes";
import {
    handle_list_appointments,
    handle_get_appointment,
    handle_create_appointment,
    handle_update_appointment,
    handle_patch_status,
    handle_cancel_appointment
} from "./routes/appointments_routes";

// 1. Inicializa subsistema de dados
init_database();

// 2. Cria instância do servidor HTTP
let mut server = Server.new(":3000", ServerConfig {
    read_timeout: 5000,
    max_body_size: 1000000
});

// 3. Configura CORS global
server.cors(CorsConfig {
    allow_origins: ["https://lesalvi.com.br", "http://localhost:5173"],
    allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers: ["Authorization", "Content-Type", "X-Require-Admin"],
    max_age: 86400
});

// 4. Registra middlewares
server.use(logging_middleware);
server.use(auth_middleware);

// 5. Registra rotas de Autenticação
server.post("/auth/login", handle_login);

// 6. Registra rotas de Catálogo de Serviços
server.get("/services", handle_list_services);
server.get("/services/:id", handle_get_service);

// 7. Registra rotas REST de Agendamentos (Todos os verbos)
server.get("/appointments", handle_list_appointments);
server.get("/appointments/:id", handle_get_appointment);
server.post("/appointments", handle_create_appointment);
server.put("/appointments/:id", handle_update_appointment);
server.patch("/appointments/:id", handle_patch_status);
server.delete("/appointments/:id", handle_cancel_appointment);

// 8. Hook de encerramento seguro (Graceful Shutdown)
server.on_shutdown(|| {
    log.info("Encerrando servidor Le Salvi de forma graciosa...", {
        status: "shutdown_complete"
    });
});

print("=============================================================");
print("🚀 Servidor Le Salvi API online em http://localhost:3000");
print("   - Health Check: GET  /healthz");
print("   - Login:        POST /auth/login");
print("   - Servicos:     GET  /services | GET /services/:id");
print("   - Agendamentos: GET, POST /appointments | GET, PUT, PATCH, DELETE /appointments/:id");
print("=============================================================");

server.start(); // Descomente para manter o processo escutando em segundo plano
