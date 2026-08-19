---
title: net/http — Servidores REST e Roteamento
description: API de servidores HTTP de alta performance, roteamento por verbos, middlewares, CORS, observabilidade e tratamento de erros.
---

O módulo `net/http` fornece um servidor HTTP de alta performance com suporte completo a verbos REST, parâmetros de rota, leitura de corpo JSON, middlewares, CORS, observabilidade integrada e recuperação automática de panics.

```flexlang
import { Server, Request, Response, ServerConfig, CorsConfig } from "net/http";
import { log } from "core/log";
import { time } from "core/time";
```

---

## 🚀 Inicialização e Roteamento

```flexlang
let config = ServerConfig {
    read_timeout: 5000,    // 5 segundos de timeout de leitura (previne Slowloris)
    max_body_size: 1048576 // Limite de 1 MB para payloads de requisição
};

let mut server = Server.new(":8080", config);

// Verbos REST
server.get("/users", list_users);
server.post("/users", create_user);
server.get("/users/:id", get_user);
server.put("/users/:id", update_user);
server.patch("/users/:id", patch_user);
server.delete("/users/:id", delete_user);

// Handlers com Closures
server.get("/ping", |req, mut res| {
    res.json({ pong: true });
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

---

## 📤 Objeto `Response`

| Método | Assinatura | Descrição |
|---|---|---|
| `status` | `res.status(code: Int)` | Define o código de status HTTP (ex: `201`, `404`). Retorna a própria `Response` para encadeamento. |
| `json` | `res.json(data: T)` | Serializa e responde com payload JSON (`Content-Type: application/json`). |
| `header` | `res.header(name: String, val: String)` | Define um cabeçalho customizado de resposta. |
| `error` | `res.error(status: Int, msg: String)` | Responde com erro JSON estruturado: `{"error": "msg"}`. |

---

## 🛡️ Middlewares & CORS

### Registrando Middlewares
Middlewares possuem a assinatura `func(req: Request, mut res: Response)`. Se um middleware emitir uma resposta (`res.json` ou `res.error`), a cadeia de execução é interrompida (*short-circuit*):

```flexlang
func auth_middleware(req: Request, mut res: Response) {
    match req.header("Authorization") {
        Option.None {
            res.error(401, "Token de autorização ausente");
        },
        Option.Some(token) {
            // Continua a cadeia normalmente
        }
    }
}

server.use(auth_middleware);
```

### Configurando CORS
```flexlang
server.cors(CorsConfig {
    allow_origins: ["https://minhafintech.com.br"],
    allow_methods: ["GET", "POST", "PUT", "DELETE"],
    allow_headers: ["Authorization", "Content-Type"],
    max_age: 3600
});
```

---

## 🔍 Observabilidade, Métricas & Confiabilidade

O módulo `net/http` foi projetado para ambientes de missão crítica com observabilidade e resiliência de nível enterprise.

### 1. Health Check Nativo (`/healthz`)
O servidor possui um endpoint de verificação de integridade embutido no runtime:
- **Rota**: `GET /healthz`
- **Resposta**: `200 OK` com `{"status": "ok"}`
- **Uso**: Integração imediata com *Liveness* e *Readiness Probes* de Kubernetes, AWS ECS e balanceadores de carga sem necessidade de criar rotas manuais.

### 2. Middleware de Tracing e Logging Estruturado
Combine `core/time` e `core/log` para rastrear requisições e tempos de resposta com mascaramento automático de segredos:

```flexlang
func request_logger(req: Request, mut res: Response) {
    let inicio = time.now();
    
    // Log estruturado em JSON com mascaramento automático de credenciais
    log.info("HTTP Request recebida", {
        path: req.param("path") catch { "" },
        auth_present: req.header("Authorization").is_some()
    });
}

server.use(request_logger);
```

### 3. Recuperação Automática de Panics (*Panic Recovery*)
Qualquer erro inesperado ou exceção não tratada dentro de um middleware ou rota é interceptada pelo runtime:
- **Segurança**: O servidor emite um log estruturado `{ "level": "error", "msg": "panic recovered in handler", "panic": "...", "ts": "..." }`.
- **Estabilidade**: O processo principal **não é encerrado**.
- **Privacidade**: O cliente recebe uma resposta HTTP `500 Internal Server Error` limpa, impedindo o vazamento de stack traces internos para a internet.

### 4. Desligamento Gracioso (*Graceful Shutdown*)
Registre rotinas de limpeza com `server.on_shutdown()`. Ao receber sinais do sistema operacional (`SIGINT`, `SIGTERM`), o servidor suspende novas conexões, conclui as requisições ativas e executa os hooks registrados:

```flexlang
server.on_shutdown(|| {
    log.info("Encerrando servidor com segurança... Fechando pools de banco.");
    db.close();
});
```
