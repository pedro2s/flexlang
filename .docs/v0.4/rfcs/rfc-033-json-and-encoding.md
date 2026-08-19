# RFC-033 — Módulo Universal de JSON e Codificações (`encoding/json`, `encoding/base64`, `encoding/hex`)

> **Status:** Proposto · **Prioridade:** P0 · **Depende de:** nada

---

## 1. Motivação

Sistemas financeiros manipulam intercâmbio de dados de pagamento (ISO 20022, JSON APIs) e segurança (assinaturas digitais, certificados, tokens criptográficos).

Atualmente na FlexLang:
- O JSON só é manipulado implicitamente via `req.json()` e `res.json()`. Não há funções livres de parsing/stringifying de strings puras em memória.
- Não existem codificadores para **Base64** (essencial para JWT, Basic Auth e payloads binários) nem **Hexadecimal** (essencial para hashes SHA-256 e chaves criptográficas).

Esta RFC introduz a suíte padrão de manipulação e codificação de dados.

---

## 2. API do Módulo `encoding/json`

```flexlang
import { json } from "encoding/json";

// 1. Parsing Type-Safe de String JSON para Structs (Paridade com unmarshal Go)
struct AccountStatus {
    account_id: String,
    amount: String,
    active: Bool
}

let json_str = "{\"account_id\": \"123\", \"amount\": \"500.00\", \"active\": true}";
let data = json.parse_as<AccountStatus>(json_str)?;

print(data.account_id); // "123"
print(data.active);     // true

// 2. Serialização de dados estritos FlexLang para String JSON
let payload = {
    "bank": "FlexBank",
    "ispb": "12345678",
    "fee": 0.05
};

let raw_json = json.stringify(payload);
// "{\"bank\":\"FlexBank\",\"ispb\":\"12345678\",\"fee\":0.05}"

// 3. Serialização formatada (Pretty Print com indentação)
let pretty_json = json.stringify_pretty(payload, 2);
```

---

## 3. API dos Módulos `encoding/base64` e `encoding/hex`

### 3.1 Base64 (`encoding/base64`)

```flexlang
import { base64 } from "encoding/base64";

// Codificação padrão (Standard Base64)
let encoded = base64.encode("usuario:senha_super_secreta");
// "dXN1YXJpbzpzZW5oYV9zdXBlcl9zZWNyZXRh"

let decoded = base64.decode(encoded)?;
// "usuario:senha_super_secreta"

// Base64 URL-Safe (para tokens JWT sem '/', '+' e sem padding '=')
let url_safe = base64.encode_url_safe("payload_jwt_data");
let orig = base64.decode_url_safe(url_safe)?;
```

### 3.2 Hexadecimal (`encoding/hex`)

```flexlang
import { hex } from "encoding/hex";

let hex_str = hex.encode("chave_pix_secreta");
let raw_bytes_str = hex.decode(hex_str)?;
```

---

## 4. Exemplo de Uso: Assinatura de Webhook Bancário

```flexlang
import { json } from "encoding/json";
import { base64 } from "encoding/base64";
import { hmac } from "crypto";
import { env } from "os/env";

func create_signed_webhook_payload(event_type: String, account_id: String, amount: String) -> String {
    let secret = env.require("WEBHOOK_HMAC_SECRET");

    let event = {
        "event": event_type,
        "account_id": account_id,
        "amount": amount,
        "timestamp": 1724000000
    };

    let json_body = json.stringify(event);
    let signature_hex = hmac.sha256(json_body, secret);
    let signature_b64 = base64.encode(signature_hex);

    return json.stringify({
        "data": json_body,
        "signature": signature_b64
    });
}
```

---

## 5. Implementação e Paridade

### 5.1 Modo Interpretado (TypeScript)
- `json.parse_as<T>` mapeia para `JSON.parse`, seguido de uma verificação estrutural (shape validation) contra a definição do tipo `T` exportada no AST para garantir que não há `any` ou dados corrompidos.
- `base64` utiliza `Buffer.from(s, 'utf-8').toString('base64')` e `Buffer.from(b64, 'base64').toString('utf-8')`.
- `hex` utiliza `Buffer.from(s, 'utf-8').toString('hex')`.

### 5.2 Modo Compilado (Go)
- `encoding/json` mapeia para `json.Unmarshal` passando a referência da struct Go associada a `T`, alcançando 100% de type-safety estático.
- `encoding/base64` mapeia para `encoding/base64.StdEncoding` e `encoding/base64.URLEncoding`.
- `encoding/hex` mapeia para `encoding/hex.EncodeToString` e `encoding/hex.DecodeString`.

---

## 6. Plano de Testes

- Golden tests de parsing de objetos aninhados, arrays de números e strings com caracteres Unicode/acentuados.
- Testes de erro em JSON malformado retornando `Result.Err("INVALID_JSON")`.
- Teste de paridade com vetores padrão RFC 4648 para Base64 e Hexadecimal.
