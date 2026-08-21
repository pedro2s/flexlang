---
title: net/http — Servidores & Clientes HTTP
description: Servidores REST de alta performance e Cliente HTTP com timeouts, pooling, suporte a multipart e recuperação automática de panics.
---

O módulo `net/http` fornece uma solução completa para comunicação HTTP em FlexLang: um **servidor HTTP de alta performance** e um **cliente HTTP robusto** com timeouts granulares, formulários multipart e integração nativa com o ecossistema assíncrono.

```flexlang
import { Server, Request, Response, ServerConfig, CorsConfig, Client, ClientConfig, MultipartForm } from "net/http";
```

---

## 🌐 1. Servidor HTTP REST

### Inicialização e Roteamento

```flexlang
let config = ServerConfig {
    read_timeout: 5000,    // 5 segundos de timeout de leitura (previne Slowloris)
    max_body_size: 1048576 // Limite de 1 MB para payloads de requisição
};

let mut server = Server.new(":8080", config);

// Configuração de CORS
server.cors(CorsConfig {
    allow_origins: ["https://flexbank.dev", "http://localhost:3000"],
    allow_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers: ["Authorization", "Content-Type", "X-Correlation-ID"],
    max_age: 86400
});

// Verbos REST
server.get("/users", list_users);
server.post("/users", create_user);
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.delete("/users/:id", delete_user);

// Handlers com Closures
server.get("/healthz", |req: Request, mut res: Response| {
    res.status(200).json({ status: "ok", uptime: "99.99%" });
});

server.start();
```

### Métodos do `Request`

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `param` | `req.param(name: String)` | `Result<String, String>` | Obtém parâmetro de rota (`/users/:id`). |
| `param_int` | `req.param_int(name: String)` | `Result<Int, String>` | Obtém parâmetro de rota convertido para `Int`. |
| `query` | `req.query(name: String)` | `Option<String>` | Obtém parâmetro de query string (`?page=2`). |
| `query_int` | `req.query_int(name: String)` | `Option<Int>` | Obtém query param como `Int`. |
| `header` | `req.header(name: String)` | `Option<String>` | Lê cabeçalho HTTP (case-insensitive). |
| `form_value` | `req.form_value(name: String)` | `Option<String>` | Extrai valor de campo de formulário (`multipart/form-data` ou `application/x-www-form-urlencoded`). |
| `form_file` | `req.form_file(name: String)` | `Option<UploadedFile>` | Extrai arquivo enviado via formulário multipart. |
| `json` | `req.json()` | `Result<T, String>` | Realiza o parse do corpo como JSON estruturado. |

### Estrutura `UploadedFile` (RFC-046)

Quando um arquivo é enviado via `multipart/form-data`, o método `req.form_file("nome")` retorna `Option.Some(UploadedFile)` com os campos:

```flexlang
struct UploadedFile {
    filename: String,     // Nome original do arquivo (ex: "contrato.pdf")
    content_type: String, // Tipo MIME (ex: "application/pdf")
    size: Int,            // Tamanho em bytes
    content: String       // Conteúdo binário/string do arquivo
}
```

#### Exemplo de Rota para Recebimento de Upload de Arquivos:

```flexlang
server.post("/api/v1/kyc/upload", |req, res| {
    let user_id = req.form_value("user_id").unwrap_or("anon");

    match req.form_file("document") {
        Option.Some(file) {
            print("Arquivo recebido: \${file.filename} (\${file.size} bytes)");
            fs.write_file("uploads/\${file.filename}", file.content);

            res.json({
                "status": "success",
                "user_id": user_id,
                "filename": file.filename,
                "bytes": file.size
            });
        }
        Option.None {
            res.status(400).json({ "error": "Campo 'document' obrigatorio" });
        }
    }
});
```

### Métodos do `Response`

| Método | Assinatura | Descrição |
|---|---|---|
| `status` | `res.status(code: Int)` | Define o código de status HTTP (ex: `200`, `201`, `404`). Retorna `Response` para encadeamento. |
| `header` | `res.header(name: String, value: String)` | Adiciona ou sobrescreve cabeçalho de resposta. |
| `json` | `res.json(data: Any)` | Serializa e envia dados no formato JSON com `Content-Type: application/json`. |
| `send_string` | `res.send_string(data: String)` | Envia texto plano com `Content-Type: text/plain`. |
| `error` | `res.error(code: Int, msg: String)` | Responde com erro estruturado `{ "error": msg }`. |

---

## 🚀 2. Cliente HTTP (`Client`)

O cliente HTTP permite efetuar chamadas síncronas/assíncronas para APIs externas e microsserviços com controle de timeout e suporte a envio de arquivos multipart.

```flexlang
let client = Client.new(ClientConfig {
    timeout_ms: 5000 // Timeout de 5s por requisição
});

// Requisição GET
let res = client.get("https://api.bacen.gov.br/pix/status")?;
print("Status: ${res.status()}");
print("Corpo: ${res.body()}");

// Requisição POST com JSON
let payload = {
    account_id: "acc_1092",
    amount: "150.00"
};
let res_post = client.post_json("https://api.bacen.gov.br/pix/transfer", payload)?;
```

### Upload de Arquivos (`MultipartForm`)

```flexlang
let form = MultipartForm.new();
form.add_field("description", "Relatório de Fechamento Diário");
form.add_file("document", "fechamento.pdf", "%PDF-1.4 ...");

let upload_res = client.post_multipart("https://storage.flexbank.dev/upload", form)?;
print("Upload status: ${upload_res.status()}");
```
