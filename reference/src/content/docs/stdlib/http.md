---
title: net/http — Servidores REST e Roteamento
description: API de servidores HTTP de alta performance, roteamento por verbos, middlewares, CORS e tratamento de erros.
---

O módulo `net/http` fornece um servidor HTTP de alta performance com suporte completo a verbos REST, parâmetros de rota, leitura de corpo JSON, middlewares, CORS e recuperação automática de panics.

```flexlang
import { Server, Request, Response } from "net/http";
```

---

## 🚀 Inicialização e Roteamento

```flexlang
let mut server = Server.new(":8080");

// Verbos REST
server.get("/users", list_users);
server.post("/users", create_user);
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.patch("/users/:id", patch_user);
server.delete("/users/:id", delete_user);

// Handlers Inline
server.get("/ping", |req, mut res| {
    res.text("pong");
});

server.start();
```

---

## 📥 Objeto `Request`

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `param` | `req.param(name: String)` | `Result<String, String>` | Obtém parâmetro de rota (`/users/:id`). |
| `param_int` | `req.param_int(name: String)` | `Result<Int, String>` | Obtém parâmetro de rota convertido para `Int`. |
| `query` | `req.query(name: String)` | `Option<String>` | Obtém parâmetro de query string (`?page=2`). |
| `query_int` | `req.query_int(name: String)` | `Option<Int>` | Obtém query param como `Int`. |
| `header` | `req.header(name: String)` | `Option<String>` | Lê cabeçalho HTTP (case-insensitive). |
| `json` | `req.json()` | `Result<T, String>` | Faz parse do corpo JSON da requisição. |

---

## 📤 Objeto `Response`

| Método | Assinatura | Descrição |
|---|---|---|
| `status` | `res.status(code: Int)` | Define o código de status HTTP (ex: `201`, `404`). |
| `json` | `res.json(data: T)` | Serializa e responde com payload JSON (`Content-Type: application/json`). |
| `text` | `res.text(content: String)` | Responde com texto puro. |
| `header` | `res.header(name: String, val: String)` | Define um cabeçalho customizado de resposta. |
| `error` | `res.error(status: Int, msg: String)` | Responde com erro JSON estruturado: `{"error": "msg"}`. |

---

## 🛡️ Middlewares & CORS

### Registrando Middlewares
Middlewares possuem a mesma assinatura de handlers (`func(req: Request, mut res: Response)`). Se um middleware escrever uma resposta (`res.status` / `res.error`), a cadeia é interrompida (*short-circuit*):

```flexlang
func auth_middleware(req: Request, mut res: Response) {
    match req.header("Authorization") {
        Option.None => {
            res.error(401, "Token de autorização ausente");
        },
        Option.Some(token) => {
            // Continua a cadeia normalmente
        }
    }
}

server.use(auth_middleware);
```

### Configurando CORS
```flexlang
server.cors({
    origins: ["https://meuapp.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    headers: ["Authorization", "Content-Type"],
    max_age: 3600
});
```

---

## 🏥 Health Check e Recuperação de Panic

- **Endpoint `/healthz`**: O servidor expõe automaticamente uma rota `/healthz` respondendo `{"status": "ok"}`.
- **Isolamento de Falhas**: Qualquer exceção ou erro não tratado dentro de um handler não derruba o processo — o servidor recupera o panic, registra o erro no log com timestamp e retorna `500 Internal Server Error` genérico ao cliente, sem vazamento de stack traces internos.
