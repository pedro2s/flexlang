---
title: crypto/jwt — JWT Tokens & Security
description: Issuing and validating JSON Web Tokens with symmetric (HMAC) and asymmetric (RSA RS256) algorithms.
---

The `crypto/jwt` module provides RFC 7519 JSON Web Token capabilities for user authentication and distributed microservice authorization.

```flexlang
import { jwt } from "crypto/jwt";
```

---

## 🔑 1. Symmetric Signing (HMAC SHA-256)

```flexlang
let claims = {
    sub: "usr_alice_1092",
    iss: "flexbank-auth",
    role: "financial_officer"
};

let sign_opts = {
    secret: "flexbank_super_secret_2026",
    expires_in: 3600 // 1 hour expiration
};

let token_res = jwt.sign(claims, sign_opts);
```

---

## 🔍 2. Verification & Claims Extraction

```flexlang
let verify_opts = {
    secret: "flexbank_super_secret_2026"
};

let verify_res = jwt.verify(token, verify_opts);
match verify_res {
    Result.Ok(payload) {
        print("Authenticated user: ${payload.sub}");
    },
    Result.Err(err) {
        print("Invalid or expired token: ${err}");
    }
}
```

---

## 🏛️ 3. Asymmetric RSA (RS256)

```flexlang
// Sign with Private Key
let rsa_sign_opts = {
    private_key_pem: "-----BEGIN RSA PRIVATE KEY-----\n...",
    algorithm: "RS256",
    expires_in: 7200
};
let rsa_token = jwt.sign_rsa(claims, rsa_sign_opts)?;

// Verify with Public Key
let rsa_verify_opts = {
    public_key_pem: "-----BEGIN PUBLIC KEY-----\n..."
};
let rsa_claims = jwt.verify_rsa(rsa_token, rsa_verify_opts)?;
```
