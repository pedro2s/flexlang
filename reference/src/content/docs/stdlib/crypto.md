---
title: crypto — Criptografia e Hashes
description: Hashing de senhas com bcrypt, geração de UUID v4, assinaturas HMAC e SHA-256.
---

O módulo `crypto` provê utilitários seguros para proteção de senhas, criação de identificadores únicos e assinaturas de segurança.

```flexlang
import { hash, uuid, hmac, sha256 } from "crypto";
```

---

## 🔑 Hashing de Senhas (Bcrypt)

Proteja senhas com algoritmo bcrypt com salt automático (fator de custo 12):

```flexlang
// Gerar hash seguro
let senha_pura = "segredo123";
let hash_salvo = hash.bcrypt(senha_pura)?;

// Verificar senha
let valida = hash.bcrypt_verify(senha_pura, hash_salvo); // true
let incorreta = hash.bcrypt_verify("senha_errada", hash_salvo); // false
```

---

## 🆔 Geração de UUID v4

Gere identificadores únicos universais (versão 4 aleatória):

```flexlang
let correlation_id = uuid.v4();
print("Correlation ID: ${correlation_id}");
// Ex: "c280dce5-25d8-4b9c-874e-b84c178abc69"
```

---

## 🔒 HMAC-SHA256 e Checksum SHA-256

Valide webhooks e integridade de arquivos:

```flexlang
let chave_secreta = "minha_chave_api_privada";
let payload = "{\"event\": \"payment.success\"}";

// Assinatura HMAC
let assinatura = hmac.sha256(chave_secreta, payload);

// Hash direto SHA-256
let hash_conteudo = sha256.digest(payload);
```
