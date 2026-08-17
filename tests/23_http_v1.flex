// Teste 23: net/http v1 - rotas com parametro, Request/Response tipados, ServerConfig (RFC-004)
// Cobertura de checker/parser/transpiler para a nova superficie; o comportamento
// de requisicao real (rotas, query, corpo JSON, limites) e coberto pelo teste de
// integracao HTTP (tests/http_integration.ts), que sobe um servidor de verdade.

import { Server, Request, Response } from "net/http";

struct CreateUserInput {
    name: String,
}

func get_user(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            print("id:");
            print(id);
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }

    match req.query("page") {
        Option.Some(page) {
            print(page);
        },
        Option.None {
            print("sem pagina");
        }
    }
}

func create_user(req: Request, mut res: Response) {
    match req.json() {
        Result.Ok(input) {
            res.status(201).json(input);
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }
}

let mut server = Server.new(":8080", ServerConfig {
    read_timeout: 5000,
    max_body_size: 1000000,
});
server.route("/users/:id", get_user);
server.route("/users", create_user);

print("rotas registradas");
