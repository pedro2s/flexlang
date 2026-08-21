---
title: crypto/jwt — Tokens JWT & Segurança
description: Emissão e validação de tokens JWT usando chaves simétricas (HMAC) e assimétricas (RSA RS256).
---

O módulo `crypto/jwt` oferece suporte completo ao padrão JSON Web Token (RFC 7519) para autenticação de usuários, microsserviços e autorização baseada em escopos.

```flexlang
import { jwt } from "crypto/jwt";
```

---

## 🔑 1. Assinatura Simétrica (HMAC SHA-256)

```flexlang
let claims = {
    sub: "usr_alice_1092",
    iss: "flexbank-auth",
    role: "financial_officer"
};

let sign_opts = {
    secret: "flexbank_super_secret_2026",
    expires_in: 3600 // Expiração em 1 hora (3600 segundos)
};

let token_res = jwt.sign(claims, sign_opts);
match token_res {
    Result.Ok(token) {
        print("Token gerado: ${token}");
    },
    Result.Err(e) {
        print("Erro ao assinar JWT: ${e}");
    }
}
```

---

## 🔍 2. Validação e Decodificação de Claims

```flexlang
let verify_opts = {
    secret: "flexbank_super_secret_2026"
};

let verify_res = jwt.verify(token, verify_opts);
match verify_res {
    Result.Ok(payload) {
        print("Usuário autenticado: ${payload.sub}");
        print("Permissão: ${payload.role}");
    },
    Result.Err(err) {
        print("Token inválido ou expirado: ${err}");
    }
}
```

---

## 🏛️ 3. Assinatura Assimétrica (RSA RS256)

Para arquiteturas enterprise de microsserviços onde o gateway autentica tokens usando apenas a chave pública.

```flexlang
// 1. Emissão com Chave Privada PEM
let rsa_sign_opts = {
    private_key_pem: "-----BEGIN RSA PRIVATE KEY-----\n...",
    algorithm: "RS256",
    expires_in: 7200
};
let rsa_token = jwt.sign_rsa(claims, rsa_sign_opts)?;

// 2. Validação com Chave Pública PEM
let rsa_verify_opts = {
    public_key_pem: "-----BEGIN PUBLIC KEY-----\n..."
};
let rsa_claims = jwt.verify_rsa(rsa_token, rsa_verify_opts)?;
```
