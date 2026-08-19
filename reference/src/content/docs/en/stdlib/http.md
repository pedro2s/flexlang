---
title: net/http — REST Servers & Routing
description: High-performance HTTP server API, REST verb routing, middlewares, CORS, and panic recovery.
---

The `net/http` native module delivers a production-grade HTTP server with full REST verbs, route parameters, JSON body parsing, middlewares, CORS, and automatic panic recovery.

```flexlang
import { Server, Request, Response } from "net/http";
```

---

## 🚀 Initialization & Routing

```flexlang
let mut server = Server.new(":8080");

// REST Verbs
server.get("/users", list_users);
server.post("/users", create_user);
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.patch("/users/:id", patch_user);
server.delete("/users/:id", delete_user);

// Inline Handlers
server.get("/ping", |req, mut res| {
    res.text("pong");
});

server.start();
```

---

## 📥 `Request` API

| Method | Signature | Return | Description |
|---|---|---|---|
| `param` | `req.param(name: String)` | `Result<String, String>` | Extracts named path parameter (`/users/:id`). |
| `param_int` | `req.param_int(name: String)` | `Result<Int, String>` | Extracts path parameter parsed as `Int`. |
| `query` | `req.query(name: String)` | `Option<String>` | Reads URL query string parameter (`?page=2`). |
| `query_int` | `req.query_int(name: String)` | `Option<Int>` | Reads query param as `Int`. |
| `header` | `req.header(name: String)` | `Option<String>` | Reads HTTP header (case-insensitive). |
| `json` | `req.json()` | `Result<T, String>` | Parses incoming JSON request body. |

---

## 📤 `Response` API

| Method | Signature | Description |
|---|---|---|
| `status` | `res.status(code: Int)` | Sets HTTP status code (e.g. `201`, `404`). |
| `json` | `res.json(data: T)` | Serializes and sends JSON response body (`application/json`). |
| `text` | `res.text(content: String)` | Sends plain text body. |
| `header` | `res.header(name: String, val: String)` | Sets custom response header. |
| `error` | `res.error(status: Int, msg: String)` | Sends structured error payload: `{"error": "msg"}`. |

---

## 🛡️ Middlewares & CORS

### Registering Middlewares
Middlewares share the standard handler signature (`func(req: Request, mut res: Response)`). If a middleware responds (`res.status` / `res.error`), the chain stops immediately (*short-circuit*):

```flexlang
func auth_middleware(req: Request, mut res: Response) {
    match req.header("Authorization") {
        Option.None => {
            res.error(401, "Missing authorization header");
        },
        Option.Some(token) => {
            // Continues pipeline
        }
    }
}

server.use(auth_middleware);
```

### CORS Configuration
```flexlang
server.cors({
    origins: ["https://myapp.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    headers: ["Authorization", "Content-Type"],
    max_age: 3600
});
```

---

## 🏥 Health Checks and Panic Recovery

- **`/healthz` Endpoint**: Servers automatically expose `/healthz` returning `{"status": "ok"}`.
- **Fault Isolation**: Uncaught exceptions inside route handlers are safely caught, logged with structured timestamps, and return a clean `500 Internal Server Error` without leaking stack traces.
