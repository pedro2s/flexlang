---
title: encoding — JSON, Base64 & Hex
description: Serialização e deserialização de dados em JSON, Base64 e Hexadecimal com tipagem estrita e alta performance.
---

Os módulos de encoding fornecem ferramentas para conversão, empacotamento e transmissão de dados binários e textuais.

```flexlang
import { json } from "encoding/json";
import { base64 } from "encoding/base64";
import { hex } from "encoding/hex";
```

---

## 📦 1. Módulo `encoding/json`

### Serialização e Parsing

```flexlang
// Serialização para String JSON (retorna Result<String, String>)
let user = {
    id: 101,
    name: "Alice",
    roles: ["admin", "developer"]
};

let json_res = json.stringify(user);
match json_res {
    Result.Ok(json_str) {
        print("JSON serializado: ${json_str}");
    },
    Result.Err(err) {
        print("Erro ao serializar: ${err}");
    }
}

// Formatação legível (pretty print com indentação de 2 espaços)
let pretty_json = json.stringify_pretty(user, 2)?;

// Parsing de String JSON para Objeto Map
let parsed_res = json.parse("{\"status\":\"approved\",\"score\":98.5}");
match parsed_res {
    Result.Ok(data) {
        let status_opt = json.get(data, "status");
        print(status_opt);
    },
    Result.Err(err) {
        print("JSON inválido: ${err}");
    }
}
```

---

## 🔐 2. Módulo `encoding/base64`

Converte dados em formato Base64 padrão RFC 4648, ideal para envio de tokens, assinaturas digitais e payloads binários em APIs REST.

```flexlang
let original = "chave_secreta_flexbank";

// Codificação
let b64_str = base64.encode(original);
print("Base64: ${b64_str}");

// Decodificação
let decoded_res = base64.decode(b64_str);
match decoded_res {
    Result.Ok(val) {
        print("Decodificado: ${val}");
    },
    Result.Err(e) {
        print("Erro ao decodificar Base64: ${e}");
    }
}
```

---

## 🔢 3. Módulo `encoding/hex`

Representação hexadecimal para digests de hash, UUIDs e bytes de chaves criptográficas.

```flexlang
let hex_data = hex.encode("hello");
print("Hex: ${hex_data}"); // "68656c6c6f"

let raw_str = hex.decode("68656c6c6f")?;
print(raw_str); // "hello"
```
