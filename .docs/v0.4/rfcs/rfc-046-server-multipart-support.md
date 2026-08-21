# RFC-046 — Suporte a Multipart/Form-Data e Upload de Arquivos no Servidor HTTP (`net/http`)

> **Status:** IMPLEMENTADO · **Prioridade:** P0 — Bloqueante · **Depende de:** RFC-004 (`net/http`), RFC-031 (`net/http: Client`)

---

## 1. Motivação e Contexto

Com a introdução do cliente HTTP nativo na RFC-031 (`MultipartForm.new()`, `post_multipart`), o ecossistema FlexLang ganhou a capacidade de realizar uploads de arquivos e formulários binários. No entanto, o lado servidor (`Server` e o objeto `Request`) estava restrito ao recebimento de JSON (`req.json()`), cabeçalhos (`req.header()`) e query/path params.

No desenvolvimento de backends enterprise e serviços financeiros (FinTechs e Core Banking), o servidor precisa receber e processar dados multipart em cenários fundamentais:
- **KYC (Know Your Customer) e Onboarding**: Upload de fotos de documentos (CNH, RG) e comprovantes de endereço.
- **Comprovantes de Transação**: Envio de PDFs e recibos de pagamento.
- **Formulários Web Tradicionais**: Processamento de requisições `application/x-www-form-urlencoded` e `multipart/form-data`.

A **RFC-046** introduz paridade completa de Multipart no servidor HTTP da FlexLang, suportando tanto o modo interpretado (Node.js/TypeScript) quanto o modo compilado nativo (Golang), sob a regra inegociável do **Parity Gate (ADR-001)**.

---

## 2. Design da API

### 2.1 Estrutura `UploadedFile`

Representa um arquivo enviado pelo cliente através de um campo multipart:

```flexlang
struct UploadedFile {
    filename: String,
    content_type: String,
    size: Int,
    content: String
}
```

- **`filename`**: Nome original do arquivo informado no cabeçalho `Content-Disposition`.
- **`content_type`**: Tipo MIME do arquivo (ex: `image/jpeg`, `application/pdf`, `text/plain`).
- **`size`**: Tamanho do arquivo em bytes.
- **`content`**: Conteúdo em bytes/string do arquivo.

---

### 2.2 Novos Métodos no Objeto `Request`

| Método | Assinatura | Descrição |
|---|---|---|
| `form_value` | `req.form_value(name: String) -> Option<String>` | Extrai o valor de um campo de texto vindo de `multipart/form-data` ou `application/x-www-form-urlencoded`. |
| `form_file` | `req.form_file(name: String) -> Option<UploadedFile>` | Extrai o arquivo recebido no campo especificado. Retorna `Option.None` se o campo não existir ou não for um arquivo. |

---

### 2.3 Exemplo de Servidor HTTP com Upload de Arquivo

```flexlang
import { Server, ServerConfig, Request, Response, UploadedFile } from "net/http";
import { fs } from "std/fs";

func main() {
    let mut server = Server.new(":8080", ServerConfig {
        read_timeout: 5000,
        max_body_size: 10000000 // 10MB
    });

    server.post("/api/v1/kyc/upload", |req, res| {
        let user_id = req.form_value("user_id").unwrap_or("anon");

        match req.form_file("document") {
            Option.Some(file) => {
                print("Arquivo recebido: \${file.filename} (\${file.size} bytes)");
                fs.write_file("storage/\${file.filename}", file.content);

                res.json({
                    "status": "success",
                    "user_id": user_id,
                    "filename": file.filename,
                    "bytes": file.size
                });
            },
            Option.None => {
                res.status(400).json({ "error": "Campo de arquivo 'document' obrigatorio" });
            }
        }
    });

    server.start();
}
```

---

## 3. Arquitetura e Paridade de Execução

### 3.1 Modo Interpretado (`flex run` — Node.js)
- O `FlexRequest` analisa os headers da requisição. Se o `Content-Type` contiver `boundary=...`, realiza a decodificação dos blocos MIME respeitando quebras de linha `\r\n\r\n` e limites dos boundaries.
- Campos de texto são mapeados para valores retornados por `req.form_value(name)`.
- Arquivos são mapeados para instâncias estruturadas de `UploadedFile` retornadas por `req.form_file(name)`.
- Suporte simultâneo a `application/x-www-form-urlencoded` via decodificação de query/form params.

### 3.2 Modo Compilado (`flex build` — Golang)
- O `Server` Go utiliza `r.rawRequest.ParseMultipartForm(int64(s.config.max_body_size))`.
- `req.form_value(name)` consulta `r.rawRequest.FormValue(name)`.
- `req.form_file(name)` extrai o cabeçalho do arquivo em `r.rawRequest.MultipartForm.File`, realiza a leitura dos bytes e preenche a struct `UploadedFile`.

---

## 4. Testes e Validação de Conformidade

- **Golden Test 58 (`tests/golden/58_server_multipart.flex`)**: Teste de integração completo onde um `Client` envia `post_multipart` com campos de texto e arquivos para o `Server`, validando que tanto no Node.js quanto em Go a resposta é 100% idêntica.
