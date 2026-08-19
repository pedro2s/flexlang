# RFC-031 — Módulo Nativo de Cliente HTTP (`net/http: Client`)

> **Status:** Proposto · **Prioridade:** P0 — Bloqueante (Solicitado) · **Depende de:** RFC-004 (`net/http`), RFC-027 (`core/time`)

---

## 1. Motivação e Caso de Uso Bancário

O backend bancário moderno interage continuamente com sistemas de terceiros através de protocolos HTTP/HTTPS:
- **Integração com BACEN Pix SPI e DICT**: Chamadas HTTPS com certificados digitais mútuos (mTLS).
- **Serviços Antifraude e Bureaus de Crédito** (Serasa, ClearSale): Avaliação de risco em tempo real durante transferências.
- **Webhooks de Liquidação Financeira**: Notificação para parceiros de crédito e adquirentes.
- **Comunicação Inter-microsserviços**: Troca de dados entre o Gateway e o Core Banking.

Atualmente, o módulo `net/http` implementa apenas o lado servidor (`Server`, `Request`, `Response`). A FlexLang precisa de um **Cliente HTTP Nativo (`Client`)** com suporte a connection pooling, keep-alive, timeouts granulares, certificados mTLS, cabeçalhos customizados, query params e serialização/deserialização automática.

---

## 2. Design da API

### 2.1 Construtor e Configurações (`ClientConfig`)

```flexlang
import { Client, ClientConfig, RequestOptions, Response } from "net/http";
import { Duration } from "core/time";

// Cliente HTTP com configurações enterprise
let client = Client.new(ClientConfig {
    timeout: Duration.seconds(5),          // Timeout total da requisição
    connect_timeout: Duration.seconds(2),  // Timeout de estabelecimento de conexão TCP
    max_idle_conns: 100,                   // Tamanho do pool de conexões ociosas (keep-alive)
    follow_redirects: true,                // Seguir redirecionamentos 3xx automaticamente
    insecure_skip_verify: false            // Validar cadeia de certificados SSL/TLS
});

// Suporte nativo a envio de Binários/Multipart para uploads de arquivos
let form_data = MultipartForm.new();
form_data.add_field("user_id", "acc-1234");
form_data.add_file("document_cnh", "cnh.jpg", fs.read_bytes("/tmp/cnh.jpg")?);

let default_client = Client.default();
```

---

### 2.2 Métodos de Requisição e Verbos HTTP

O `Client` oferece métodos ergonômicos para os principais verbos HTTP, retornando `Result<Response, String>`:

| Método | Assinatura | Descrição |
|---|---|---|
| `get` | `client.get(url: String) -> Result<Response, String>` | Requisição GET simples |
| `get_with` | `client.get_with(url: String, options: RequestOptions) -> Result<Response, String>` | GET com headers e query params |
| `post` | `client.post(url: String, body: String) -> Result<Response, String>` | POST com corpo em string |
| `post_json` | `client.post_json(url: String, data: Map) -> Result<Response, String>` | POST com objeto serializado em JSON e `Content-Type: application/json` |
| `post_multipart` | `client.post_multipart(url: String, form: MultipartForm) -> Result<Response, String>` | POST de arquivos e formulários binários |
| `put` | `client.put(url: String, body: String) -> Result<Response, String>` | PUT com corpo em string |
| `put_json` | `client.put_json(url: String, data: Map) -> Result<Response, String>` | PUT com objeto JSON |
| `patch_json` | `client.patch_json(url: String, data: Map) -> Result<Response, String>` | PATCH com objeto JSON |
| `delete` | `client.delete(url: String) -> Result<Response, String>` | DELETE simples |
| `request` | `client.request(method: String, url: String, options: RequestOptions) -> Result<Response, String>` | Método universal configurável |

---

### 2.3 Objeto de Resposta (`Response`) do Cliente

A struct `Response` provê métodos para inspeção de cabeçalhos, status code e leitura do corpo:

```flexlang
let response = client.get("https://api.bacen.gov.br/pix/keys/12345678900")?;

print(response.status_code);                    // 200 (Int)
print(response.header("Content-Type"));         // Option.Some("application/json")
print(response.is_success());                   // true (2xx)
print(response.body_string());                  // Corpo como String crua
let data = response.json()?;                    // Parsing de JSON retornando Map/Struct
```

---

### 2.4 Exemplo de Uso Real: Consulta de Chave Pix no BACEN

```flexlang
import { Client, ClientConfig, RequestOptions } from "net/http";
import { Duration } from "core/time";
import { Decimal } from "math/decimal";
import { log } from "core/log";

struct PixKeyResponse {
    key: String,
    account_id: String,
    owner_name: String,
    bank_ispb: String
}

func query_pix_key(pix_key: String) -> Result<PixKeyResponse, String> {
    let client = Client.new(ClientConfig {
        timeout: Duration.seconds(3),
        connect_timeout: Duration.seconds(1),
        max_idle_conns: 50,
        follow_redirects: false,
        insecure_skip_verify: false
    });

    let url = "https://spi.bacen.gov.br/api/v1/dict/keys/${pix_key}";
    
    let res = client.get_with(url, RequestOptions {
        headers: {
            "Authorization": "Bearer ${get_bacen_token()}",
            "X-Correlation-ID": "corr-uuid-12345"
        },
        query: {
            "version": "2.0"
        }
    }) catch err {
        log.error("Falha de rede ao consultar DICT do BACEN", { error: err });
        return Result.Err("BACEN_UNAVAILABLE");
    };

    if res.status_code == 404 {
        return Result.Err("PIX_KEY_NOT_FOUND");
    }

    if res.status_code != 200 {
        return Result.Err("BACEN_ERROR_STATUS_${res.status_code}");
    }

    let payload = res.json()?;
    return Result.Ok(PixKeyResponse {
        key: payload.get("key"),
        account_id: payload.get("account_id"),
        owner_name: payload.get("owner_name"),
        bank_ispb: payload.get("bank_ispb")
    });
}
```

---

## 3. Implementação e Paridade

### 3.1 Modo Interpretado (TypeScript / Node.js)
- Utiliza a API `fetch` nativa do Node 18+ ou o `undici.Agent` / `http.Agent` para garantir controle estrito de pooling de sockets (`keepAlive: true`, `maxSockets`, `timeout`).
- Abstração uniforme que retorna o mesmo shape de `Response` e `Result`.

### 3.2 Modo Compilado (Go Nativo)
- O transpiler Go mapeia para `&http.Client` nativo do Go com `&http.Transport` configurado:
  - `MaxIdleConns`, `MaxIdleConnsPerHost`, `IdleConnTimeout`, `DialContext` com timeout.
  - TLS Config com `tls.Config{InsecureSkipVerify: ...}`.
- Alta taxa de transferência com zero alocação intermediária desnecessária.

---

## 4. Plano de Testes

1. **Golden Tests Unitários**:
   - Requisições GET e POST contra servidor local.
   - Headers customizados e query parameters codificados.
   - Parsing de JSON com `res.json()`.
2. **Testes de Resiliência de Conexão**:
   - Timeout de conexão disparando `Result.Err("TIMEOUT")`.
   - Tratamento de status codes 4xx e 5xx sem panic.
3. **Parity Gate**:
   - `stdout` e payload de resposta idênticos entre TypeScript e binário Go.
