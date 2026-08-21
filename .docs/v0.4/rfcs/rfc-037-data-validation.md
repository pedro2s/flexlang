# RFC-037 — Módulo de Validação Declarativa de Dados (`std/validator`)

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** RFC-019 (`String methods`), RFC-025 (`math/decimal`)

---

## 1. Motivação

APIs bancárias recebem requisições com dados sensíveis de clientes e valores monetários. Sem validação rigorosa na borda (*input sanitization & validation*), erros como CPFs inválidos, valores negativos, e-mails malformados e injeções de dados podem atingir a camada de banco de dados e contabilidade.

Esta RFC introduz o módulo `std/validator` para validação de campos individuais e validação estruturada de DTOs.

---

## 2. Design da API

```flexlang
import { validator, ValidationResult, ValidationError } from "std/validator";
import { Decimal } from "math/decimal";

// 1. Validações Primitivas Prontas
let is_valid_cpf = validator.cpf("123.456.789-00");      // Validação de dígitos verificadores
let is_valid_cnpj = validator.cnpj("12.345.678/0001-90");
let is_valid_email = validator.email("cliente@flexbank.com.br");
let is_valid_uuid = validator.uuid("550e8400-e29b-41d4-a716-446655440000");

// 2. Validador Estruturado com Builder
struct TransferRequestDTO {
    source_account: String,
    target_pix_key: String,
    amount: Decimal,
    description: String
}

func validate_transfer_dto(dto: TransferRequestDTO) -> Result<Void, [ValidationError]> {
    let mut v = validator.new();

    v.field("source_account", dto.source_account)
     .required()
     .min_len(5)
     .max_len(20);

    v.field("target_pix_key", dto.target_pix_key)
     .required();

    if dto.amount.lte(Decimal.new("0.00")) {
        v.add_error("amount", "Valor da transferência deve ser estritamente maior que zero");
    }

    if dto.description.len() > 140 {
        v.add_error("description", "Descrição não pode exceder 140 caracteres");
    }

    return v.result();
}
```

---

## 3. Integração com o Handler HTTP

```flexlang
server.post("/transfers", |req, mut res| {
    let body = req.json() catch err {
        res.error(400, "Corpo da requisição JSON inválido");
        return;
    };

    let dto = TransferRequestDTO {
        source_account: body.get("source_account"),
        target_pix_key: body.get("target_pix_key"),
        amount: Decimal.new(body.get("amount")),
        description: body.get("description")
    };

    match validate_transfer_dto(dto) {
        Result.Ok(_) {
            // Executa transferência...
            res.status(201).json({ status: "PROCESSING" });
        },
        Result.Err(errors) {
            // Retorna lista amigável de campos com erro (RFC 7807)
            res.status(422).json({
                error: "VALIDATION_FAILED",
                details: errors
            });
        }
    }
});
```

---

## 4. Implementação e Paridade

- Algoritmos matemáticos de validação de CPF (módulo 11) e CNPJ idênticos no TypeScript e no Go.
- Retorno de struct serializável `ValidationError { field: String, message: String }`.
- Parity gate 100% verde.
