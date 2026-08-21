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

// File Upload Route (RFC-046)
server.post("/api/v1/kyc/upload", |req: Request, mut res: Response| {
    let user_id = req.form_value("user_id").unwrap_or("anon");

    match req.form_file("document") {
        Option.Some(file) {
            print("Received file: \${file.filename} (\${file.size} bytes)");
            res.json({
                "status": "success",
                "user_id": user_id,
                "filename": file.filename,
                "bytes": file.size
            });
        }
        Option.None {
            res.status(400).json({ "error": "Field 'document' is required" });
        }
    }
});

server.start();
```

### `UploadedFile` Structure (RFC-046)

```flexlang
struct UploadedFile {
    filename: String,     // Original filename (e.g. "invoice.pdf")
    content_type: String, // MIME type (e.g. "application/pdf")
    size: Int,            // Size in bytes
    content: String       // File payload string/bytes
}
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
