---
title: net/http — HTTP Servers & Clients
description: High-performance REST HTTP servers and HTTP Client with timeouts, connection pooling, multipart support, and automatic panic recovery.
---

The `net/http` module provides a comprehensive networking toolkit in FlexLang: a **high-performance HTTP server** and a **resilient HTTP client** with granular timeout management, multipart forms, and native async concurrency integration.

```flexlang
import { Server, Request, Response, ServerConfig, CorsConfig, Client, ClientConfig, MultipartForm } from "net/http";
```

---

## 🌐 1. REST HTTP Server

### Setup & Routing

```flexlang
let config = ServerConfig {
    read_timeout: 5000,    // 5s read timeout (prevents Slowloris attacks)
    max_body_size: 1048576 // 1MB payload size limit
};

let mut server = Server.new(":8080", config);

// CORS configuration
server.cors(CorsConfig {
    allow_origins: ["https://flexbank.dev", "http://localhost:3000"],
    allow_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers: ["Authorization", "Content-Type", "X-Correlation-ID"],
    max_age: 86400
});

// REST Routes
server.get("/users", list_users);
server.post("/users", create_user);
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.delete("/users/:id", delete_user);

// Inline Closures
server.get("/healthz", |req: Request, mut res: Response| {
    res.status(200).json({ status: "ok", uptime: "99.99%" });
});

server.start();
```

---

## 🚀 2. HTTP Client (`Client`)

```flexlang
let client = Client.new(ClientConfig {
    timeout_ms: 5000
});

let res = client.get("https://api.bacen.gov.br/pix/status")?;
print("Status: ${res.status()}");
print("Body: ${res.body()}");

// File Upload with MultipartForm
let form = MultipartForm.new();
form.add_field("description", "Daily Financial Audit");
form.add_file("document", "audit.pdf", "%PDF-1.4 ...");

let upload_res = client.post_multipart("https://storage.flexbank.dev/upload", form)?;
```
