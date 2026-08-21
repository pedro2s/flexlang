---
title: data/validator — Declarative Data Validation
description: Business document validation (CPF, CNPJ), email, UUID, and fluent validation builder for DTOs.
---

The `std/validator` module (also available as `data/validator`) provides validation for business identifiers, web formats, and a **fluent `Validator` builder**.

```flexlang
import { validator, Validator, ValidationError } from "data/validator";
```

---

## 🆔 1. Direct Validation

```flexlang
// CPF & CNPJ Checksum Verification
let is_cpf = validator.cpf("529.982.247-25");
let is_cnpj = validator.cnpj("11.222.333/0001-81");

// RFC 5322 Email
let is_email = validator.email("finance@flexbank.dev");

// UUID
let is_uuid = validator.uuid("e9a8f273-0491-4c6e-821b-6893c52a0912");
```

---

## 📋 2. Fluent `Validator` Builder

```flexlang
let mut v = validator.new();

v.field("cpf", cpf_input).required().cpf();
v.field("email", email_input).required().email();
v.field("password", pass_input).required().min_len(8);

if (!v.is_valid()) {
    print("Validation errors:");
    for (err in v.errors()) {
        print("- [${err.field}]: ${err.message}");
    }
} else {
    print("Payload is valid!");
}
```
