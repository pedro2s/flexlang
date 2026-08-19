---
title: crypto — Cryptography & Hashes
description: Password hashing with bcrypt, UUID v4 generation, HMAC-SHA256 signatures, and SHA-256 digests.
---

# `crypto` — Cryptography & Hashes

The `crypto` module provides secure primitives for authentication, unique identifiers, and payload signatures.

```flexlang
import { hash, uuid, hmac, sha256 } from "crypto";
```

---

## 🔑 Password Hashing (Bcrypt)

Hash and verify credentials securely via salted bcrypt (cost factor 12):

```flexlang
// Hash raw password
let plain = "secret123";
let hashed = hash.bcrypt(plain)?;

// Verify password
let is_valid = hash.bcrypt_verify(plain, hashed); // true
let is_invalid = hash.bcrypt_verify("wrong_password", hashed); // false
```

---

## 🆔 UUID v4 Generation

Generate cryptographically strong random version 4 UUIDs:

```flexlang
let correlation_id = uuid.v4();
print("Correlation ID: ${correlation_id}");
// Example: "c280dce5-25d8-4b9c-874e-b84c178abc69"
```

---

## 🔒 HMAC-SHA256 & SHA-256 Digest

Sign partner webhooks and generate file integrity checksums:

```flexlang
let secret_key = "my_private_api_key";
let payload = "{\"event\": \"payment.success\"}";

// HMAC Signature
let signature = hmac.sha256(secret_key, payload);

// SHA-256 Digest
let digest = sha256.digest(payload);
```
