import { Server, Request, Response, ServerConfig, CorsConfig } from "net/http";

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

// Handlers registrados via server.get/post etc.
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

func echo_headers(req: Request, mut res: Response) {
    let mut auth = "missing";
    match req.header("authorization") {
        Option.Some(a) {
            auth = a;
        },
        Option.None {
            auth = "missing";
        }
    }
    res.header("X-Echo-Auth", auth).status(200).json(auth);
}

func trigger_panic(req: Request, mut res: Response) {
    let arr = [1];
    print(arr[100]);
}

// Middleware 1: Adiciona cabeçalho X-Global-Mw e não encerra
func mw_add_header(req: Request, mut res: Response) {
    res.header("X-Global-Mw", "active");
}

// Middleware 2: Se requisição tiver header X-Block-Me, responde 403 e encerra
func mw_blocker(req: Request, mut res: Response) {
    match req.header("X-Block-Me") {
        Option.Some(val) {
            res.error(403, "blocked by middleware");
        },
        Option.None {
            // segue
        }
    }
}

let mut server = Server.new(":__PORT__", ServerConfig {
    read_timeout: 5000,
    max_body_size: 64,
});

server.cors(CorsConfig {
    allow_origins: ["http://example.com", "http://app.test"],
    allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers: ["Authorization", "Content-Type", "X-Custom-Header"],
    max_age: 3600,
});

server.use(mw_add_header);
server.use(mw_blocker);

server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.patch("/users/:id", patch_user);
server.delete("/users/:id", delete_user);
server.post("/users", create_user);
server.get("/headers", echo_headers);
server.get("/panic", trigger_panic);
server.start();
