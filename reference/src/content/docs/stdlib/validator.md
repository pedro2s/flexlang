---
title: data/validator — Validação Declarativa de Dados
description: Validação de documentos fiscais (CPF, CNPJ), e-mails, UUIDs e API fluente de validação de formulários e DTOs.
---

O módulo `std/validator` (também importável via `data/validator`) fornece validação de alta performance para documentos de negócio brasileiros (CPF, CNPJ com cálculo de dígitos verificadores e rejeição de repetidos), formatos da web (e-mail, UUID) e uma **API fluente com `Validator`**.

```flexlang
import { validator, Validator, ValidationError } from "data/validator";
```

---

## 🆔 1. Validação Direta de Documentos & Formatos

```flexlang
// CPF (com cálculo estrito de dígitos e rejeição de sequências 111.111...)
let is_cpf_valid = validator.cpf("529.982.247-25"); // true
let is_fake_cpf = validator.cpf("111.111.111-11");  // false

// CNPJ (com verificação de dígitos verificadores)
let is_cnpj_valid = validator.cnpj("11.222.333/0001-81"); // true

// E-mail (RFC 5322)
let is_email_valid = validator.email("financeiro@flexbank.com.br"); // true

// UUID
let is_uuid = validator.uuid("e9a8f273-0491-4c6e-821b-6893c52a0912"); // true
```

---

## 📋 2. Validação Fluente com `Validator`

Permite encadear regras por campo e coletar erros estruturados:

```flexlang
let cpf_input = "529.982.247-25";
let email_input = "contato@flexbank.com.br";
let senha_input = "secret123";

let mut v = validator.new();

v.field("cpf", cpf_input).required().cpf();
v.field("email", email_input).required().email();
v.field("senha", senha_input).required().min_len(8).max_len(32);

if (!v.is_valid()) {
    print("Foram encontrados erros de validação:");
    for (err in v.errors()) {
        print("- [${err.field}]: ${err.message}");
    }
} else {
    print("Todos os campos estão válidos!");
}

// Ou obtenha diretamente um Result<Void, Array<ValidationError>>
let validation_result = v.result();
```
