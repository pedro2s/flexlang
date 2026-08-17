// FlexLang: API REST Completa com net/http (RFC-004)
// Demonstra rotas dinâmicas, parsing de JSON, query/path params e respostas HTTP estruturadas.

import { Server, Request, Response } from "net/http";

struct CreateUserDTO {
    name: String,
    role: String
}

struct User {
    id: Int,
    name: String,
    role: String
}

// 1. Rota de Health Check
func handle_health(req: Request, mut res: Response) {
    res.json("OK - Servico FlexLang operacional");
}

// 2. Rota de Busca por ID com Path Params e Query Params
func handle_get_user(req: Request, mut res: Response) {
    let id_res = req.param_int("id");
    match id_res {
        Result.Ok(id) {
            if id == 1 {
                let user = User { id: 1, name: "Alice", role: "admin" };
                res.json(user);
            } else {
                if id == 2 {
                    let user = User { id: 2, name: "Bob", role: "developer" };
                    res.json(user);
                } else {
                    res.error(404, "Usuario nao encontrado");
                }
            }
        },
        Result.Err(e) {
            res.error(400, "ID de usuario invalido");
        }
    }
}

// 3. Rota de Criacao com Body JSON Tipado
func handle_create_user(req: Request, mut res: Response) {
    match req.json() {
        Result.Ok(dto) {
            res.status(201).json(dto);
        },
        Result.Err(err) {
            res.error(400, "Corpo JSON malformatado ou invalido");
        }
    }
}

// Configuração e Inicialização do Servidor
let mut server = Server.new(":8080");

server.get("/health", handle_health);
server.get("/users/:id", handle_get_user);
server.post("/users", handle_create_user);

print("=================================================");
print("🚀 Servidor FlexLang REST API escutando em :8080");
print("   - GET  /health");
print("   - GET  /users/:id");
print("   - POST /users");
print("=================================================");

// server.start(); // Descomente para rodar o servidor em modo de escuta contínua
