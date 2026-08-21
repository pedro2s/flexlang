---
title: encoding — JSON, Base64 & Hex
description: Data serialization and deserialization across JSON, Base64, and Hexadecimal formats with strict typing and high throughput.
---

The encoding modules provide built-in utilities for converting, packaging, and transmitting binary and structured data.

```flexlang
import { json } from "encoding/json";
import { base64 } from "encoding/base64";
import { hex } from "encoding/hex";
```

---

## 📦 1. `encoding/json`

```flexlang
// Stringify to JSON (returns Result<String, String>)
let user = {
    id: 101,
    name: "Alice",
    roles: ["admin", "developer"]
};

let json_res = json.stringify(user);
match json_res {
    Result.Ok(json_str) {
        print("Serialized: ${json_str}");
    },
    Result.Err(err) {
        print("Serialization error: ${err}");
    }
}

// Pretty print JSON
let pretty_json = json.stringify_pretty(user, 2)?;

// Parse JSON string
let parsed_res = json.parse("{\"status\":\"approved\",\"score\":98.5}");
match parsed_res {
    Result.Ok(data) {
        let status = json.get(data, "status");
        print(status);
    },
    Result.Err(err) {
        print("Invalid JSON: ${err}");
    }
}
```

---

## 🔐 2. `encoding/base64`

RFC 4648 compliant Base64 encoding for signatures, tokens, and binary payloads.

```flexlang
let original = "flexbank_secret_key";

let b64_str = base64.encode(original);
let decoded_res = base64.decode(b64_str);
```

---

## 🔢 3. `encoding/hex`

Hexadecimal representations for cryptographic digests and raw identifiers.

```flexlang
let hex_data = hex.encode("hello");
let raw_str = hex.decode("68656c6c6f")?;
```
