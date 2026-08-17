// Fixture do teste de integracao HTTP (tests/http_integration.ts, RFC-004).
// "__PORT__" e substituido pelo runner antes de interpretar/transpilar: o mesmo
// arquivo sobe em modo interpretado e compilado, em portas diferentes.

import { Server, Request, Response } from "net/http";

struct CreateUserInput {
    name: String,
}

func get_user(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            match req.query("verbose") {
                Option.Some(v) {
                    res.json(v);
                },
                Option.None {
                    res.status(200).json(id);
                }
            }
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }
}

// Handlers registrados via server.route() ficam com assinatura Void (o Go do
// mux precisa de um tipo de função uniforme para toda rota) — por isso o `?`
// (que exige retorno Result/Option) mora numa função auxiliar, e o handler só
// faz match no resultado dela. E' aqui que o T de `req.json()` fica concreto
// (CreateUserInput), exercitando o DecodeJSON[T] do transpiler (RFC-004).
func parse_create_user(req: Request) -> Result<CreateUserInput, String> {
    let body: CreateUserInput = req.json()?;
    return Result.Ok(body);
}

func create_user(req: Request, mut res: Response) {
    match parse_create_user(req) {
        Result.Ok(input) {
            res.status(201).json(input);
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }
}

func update_user(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            res.status(200).json("user updated");
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }
}

func patch_user(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            res.status(200).json("user patched");
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }
}

func delete_user(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            res.status(200).json("user deleted");
        },
        Result.Err(msg) {
            res.error(400, msg);
        }
    }
}

func trigger_panic(req: Request, mut res: Response) {
    let arr = [1];
    print(arr[100]);
}

let mut server = Server.new(":__PORT__", ServerConfig {
    read_timeout: 5000,
    max_body_size: 64,
});
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.patch("/users/:id", patch_user);
server.delete("/users/:id", delete_user);
server.post("/users", create_user);
server.get("/panic", trigger_panic);
server.start();
