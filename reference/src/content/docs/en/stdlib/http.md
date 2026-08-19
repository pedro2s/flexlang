---
title: net/http — REST Servers & Routing
description: High-performance HTTP server API, REST routing, middlewares, CORS, observability, and error handling.
---

The `net/http` native module delivers a production-grade HTTP server with full REST verbs, route parameters, JSON body parsing, middlewares, CORS, built-in observability, and automatic panic recovery.

```flexlang
import { Server, Request, Response, ServerConfig, CorsConfig } from "net/http";
import { log } from "core/log";
import { time } from "core/time";
```

---

## 🚀 Initialization & Routing

```flexlang
let config = ServerConfig {
    read_timeout: 5000,    // 5 seconds read timeout (protects against Slowloris)
    max_body_size: 1048576 // 1 MB payload body limit
};

let mut server = Server.new(":8080", config);

// REST Verbs
server.get("/users", list_users);
server.post("/users", create_user);
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.patch("/users/:id", patch_user);
server.delete("/users/:id", delete_user);

// Closure Handlers
server.get("/ping", |req, mut res| {
    res.json({ pong: true });
});

server.start();
```

---

## 📥 `Request` Object

| Method | Signature | Returns | Description |
|---|---|---|---|
| `param` | `req.param(name: String)` | `Result<String, String>` | Retrieves route parameter (`/users/:id`). |
| `param_int` | `req.param_int(name: String)` | `Result<Int, String>` | Retrieves route parameter converted to `Int`. |
| `query` | `req.query(name: String)` | `Option<String>` | Retrieves query string parameter (`?page=2`). |
| `query_int` | `req.query_int(name: String)` | `Option<Int>` | Retrieves query parameter as `Int`. |
| `header` | `req.header(name: String)` | `Option<String>` | Reads HTTP header (case-insensitive). |

---

## 📤 `Response` Object

| Method | Signature | Description |
|---|---|---|
| `status` | `res.status(code: Int)` | Sets HTTP status code (e.g. `201`, `404`). Returns `Response` for chaining. |
| `json` | `res.json(data: T)` | Serializes and sends JSON response body (`Content-Type: application/json`). |
| `header` | `res.header(name: String, val: String)` | Sets custom HTTP response header. |
| `error` | `res.error(status: Int, msg: String)` | Sends structured error JSON: `{"error": "msg"}`. |

---

## 🛡️ Middlewares & CORS

### Registering Middlewares
Middlewares share the handler signature `func(req: Request, mut res: Response)`. If a middleware writes a response (`res.json` or `res.error`), the pipeline short-circuits:

```flexlang
func auth_middleware(req: Request, mut res: Response) {
    match req.header("Authorization") {
        Option.None {
            res.error(401, "Missing authorization token");
        },
        Option.Some(token) {
            // Pipeline proceeds normally
        }
    }
}

server.use(auth_middleware);
```

### Configuring CORS
```flexlang
server.cors(CorsConfig {
    allow_origins: ["https://myfintech.com"],
    allow_methods: ["GET", "POST", "PUT", "DELETE"],
    allow_headers: ["Authorization", "Content-Type"],
    max_age: 3600
});
```

---

## 🔍 Observability, Metrics & Reliability

The `net/http` module is built for mission-critical production environments with enterprise-grade resilience.

### 1. Built-in Health Check Endpoint (`/healthz`)
The HTTP runtime serves a built-in health probe:
- **Route**: `GET /healthz`
- **Response**: `200 OK` with `{"status": "ok"}`
- **Usage**: Out-of-the-box support for Kubernetes *Liveness* and *Readiness Probes*, AWS ALB, and load balancers without declaring manual routes.

### 2. Request Tracing & Structured Logging
Combine `core/time` and `core/log` to track requests and latency with automatic secret sanitization:

```flexlang
func request_logger(req: Request, mut res: Response) {
    let start = time.now();
    
    // Structured JSON log with credential auto-masking
    log.info("HTTP Request received", {
        path: req.param("path") catch { "" },
        auth_present: req.header("Authorization").is_some()
    });
}

server.use(request_logger);
```

### 3. Automatic Panic Recovery
Any unhandled exception inside middlewares or route handlers is safely caught by the runtime:
- **Safety**: The server outputs a structured log `{ "level": "error", "msg": "panic recovered in handler", "panic": "...", "ts": "..." }`.
- **Uptime**: The master process **never crashes**.
- **Privacy**: The client receives a clean `500 Internal Server Error`, preventing internal stack traces from leaking to the public internet.

### 4. Graceful Shutdown (`server.on_shutdown`)
Register cleanup hooks with `server.on_shutdown()`. Upon receiving OS signals (`SIGINT`, `SIGTERM`), the server stops accepting new connections, drains in-flight requests, and invokes registered hooks:

```flexlang
server.on_shutdown(|| {
    log.info("Gracefully shutting down server... Closing database pool.");
    db.close();
});
```
