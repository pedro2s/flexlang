# RFC-035 — Módulo Nativo de Autenticação JWT (`crypto/jwt`)

> **Status:** Proposto · **Prioridade:** P0 — Bloqueante · **Depende de:** RFC-028 (`crypto`), RFC-033 (`encoding/base64`, `encoding/json`), RFC-027 (`core/time`)

---

## 1. Motivação

Em ecossistemas bancários distribuídos e arquiteturas de microsserviços, a autenticação por **Tokens JWT (RFC 7519)** é o padrão universal. 

Bancos exigem dois tipos primordiais de assinatura de tokens:
1. **HS256 (HMAC com SHA-256)**: Chave simétrica secreta, ideal para comunicação interna rápida ou autenticação de clientes finais.
2. **RS256 (RSA com Chave Pública/Privada)**: Assinatura assimétrica, onde o serviço emissor de Auth assina o token com a Chave Privada, e todos os demais microsserviços (Core, Pix, Cartões) validam o token utilizando apenas a Chave Pública, sem nunca ter acesso à chave de assinatura.

---

## 2. Design da API

### 2.1 Emissão de Tokens JWT

```flexlang
import { jwt, JwtConfig, JwtSignOptions } from "crypto/jwt";
import { Duration } from "core/time";

// 1. Assinatura com Chave Simétrica (HS256)
let token_hs256 = jwt.sign(
    {
        "sub": "user-uuid-12345",
        "account_id": "acc-9876",
        "role": "customer",
        "scopes": ["pix:read", "pix:write"]
    },
    JwtSignOptions {
        secret: "super_secret_jwt_key_2026",
        algorithm: "HS256",
        expires_in: Duration.minutes(15),
        issuer: "flexbank-auth-service"
    }
)?;

// 2. Assinatura com Chave Assimétrica RSA (RS256)
let private_key_pem = fs.read_to_string("/etc/flexbank/jwt_private.pem")?;

let token_rs256 = jwt.sign_rsa(
    {
        "sub": "user-uuid-12345",
        "role": "admin"
    },
    JwtSignOptions {
        private_key_pem: private_key_pem,
        algorithm: "RS256",
        expires_in: Duration.hours(1),
        issuer: "flexbank-auth-service"
    }
)?;
```

---

### 2.2 Verificação e Validação de Tokens JWT

```flexlang
import { jwt, JwtVerifyOptions } from "crypto/jwt";

// 1. Verificação Simétrica (HS256)
let verified = jwt.verify(
    token_str,
    JwtVerifyOptions {
        secret: "super_secret_jwt_key_2026",
        expected_issuer: "flexbank-auth-service"
    }
)?;

print(verified.claims.get("sub"));        // "user-uuid-12345"
print(verified.claims.get("account_id")); // "acc-9876"
print(verified.is_expired());             // false

// 2. Verificação Assimétrica (RS256 - apenas com Chave Pública)
let public_key_pem = fs.read_to_string("/etc/flexbank/jwt_public.pem")?;

let verified_rsa = jwt.verify_rsa(
    token_rs256_str,
    JwtVerifyOptions {
        public_key_pem: public_key_pem,
        expected_issuer: "flexbank-auth-service"
    }
)?;
```

---

## 3. Middleware de Autenticação JWT para o Servidor HTTP

```flexlang
import { Server, Request, Response } from "net/http";
import { jwt, JwtVerifyOptions } from "crypto/jwt";
import { env } from "os/env";

func jwt_auth_middleware(req: Request, mut res: Response) {
    let auth_header = req.header("Authorization");
    match auth_header {
        Option.Some(header_val) {
            if !header_val.starts_with("Bearer ") {
                res.status(401).json({ error: "INVALID_AUTH_SCHEME" });
                return;
            }

            let token = header_val.substring(7, header_val.len());
            let secret = env.require("JWT_SECRET");

            match jwt.verify(token, JwtVerifyOptions { secret: secret }) {
                Result.Ok(verified) {
                    // Token válido! Adiciona claims no contexto da requisição
                    req.set_context("user_id", verified.claims.get("sub"));
                    req.set_context("role", verified.claims.get("role"));
                },
                Result.Err(err) {
                    res.status(401).json({ error: "UNAUTHORIZED", reason: err });
                    return;
                }
            }
        },
        Option.None {
            res.status(401).json({ error: "MISSING_AUTHORIZATION_HEADER" });
            return;
        }
    }
}
```

---

## 4. Implementação e Paridade

### 4.1 Modo Interpretado (TypeScript)
- Utiliza a biblioteca `jsonwebtoken` ou a API nativa `crypto` do Node.js (`crypto.createSign`, `crypto.createVerify`, `crypto.createHmac`).
- Implementa validação estrita de expiração (`exp`), data de emissão (`iat`), emissor (`iss`) e algoritmo.

### 4.2 Modo Compilado (Go)
- O transpiler Go mapeia para o pacote `github.com/golang-jwt/jwt/v5` (padrão de facto em Go para JWT).
- Emite suporte nativo a `jwt.SigningMethodHS256` e `jwt.SigningMethodRS256`.

---

## 5. Plano de Testes

- Geração e verificação de token HS256 válido.
- Geração e verificação de token RS256 com par de chaves RSA (2048-bit).
- Teste de rejeição de token expirado (`Result.Err("TOKEN_EXPIRED")`).
- Teste de rejeição de assinatura inválida ou forjada (`Result.Err("INVALID_SIGNATURE")`).
- Parity gate 100% verde entre TypeScript e Go.
