---
title: "Estudo de Caso: FlexBank API"
description: Como construir uma API Bancária Fintech completa com FlexLang, Decimal, PostgreSQL, Auth e Observabilidade.
---

# Estudo de Caso: FlexBank API (Fintech)

O **FlexBank API** (`examples/09_flexbank_api`) é o projeto de referência enterprise da FlexLang. Ele demonstra como construir um sistema financeiro robusto, seguro e livre de erros de arredondamento.

---

## 🏛️ Arquitetura do Projeto

```text
examples/09_flexbank_api/
├── flex.toml
├── src/
│   ├── main.flex                # Inicialização do servidor HTTP e middlewares
│   ├── config/settings.flex     # Variáveis de ambiente tipadas
│   ├── database/db.flex         # Pool PostgreSQL e migrations
│   ├── models/                  # Entidades (Account, Transaction, Auth)
│   ├── routes/                  # Endpoints REST (auth, accounts, transfers)
│   ├── services/
│   │   ├── transfer_service.flex # Regras de TED/Pix e transações ACID
│   │   └── interest_service.flex # Cálculos de juros compostos com Decimal
│   ├── middlewares/auth.flex    # Validação de token JWT/UUID
│   └── traits/auditable.flex    # Trait de auditoria
```

---

## 🔑 Destaques de Implementação

### 1. Cálculos Financeiros com `math/decimal`
```flexlang
import { Decimal } from "math/decimal";

func processar_transferencia(mut origem: Account, mut destino: Account, valor: Decimal) -> Result<Void, String> {
    if origem.balance.equals(valor) == false && origem.balance.sub(valor).is_negative() {
        return Result.Err("Saldo insuficiente para transferência");
    }

    origem.balance = origem.balance.sub(valor);
    destino.balance = destino.balance.add(valor);

    return Result.Ok(Void);
}
```

### 2. Autenticação Segura com `crypto`
```flexlang
import { hash, uuid } from "crypto";

func autenticar(email: String, senha_pura: String) -> Result<String, String> {
    let user = repo.find_by_email(email)?;
    
    if hash.bcrypt_verify(senha_pura, user.password_hash) == false {
        return Result.Err("Credenciais inválidas");
    }

    let token = uuid.v4();
    return Result.Ok(token);
}
```

### 3. Tratamento de Falhas com `catch`
```flexlang
let extrato = service.gerar_extrato(account_id) catch err {
    log.error("Falha ao gerar extrato", { account: account_id, erro: err });
    res.error(500, "Erro interno ao processar extrato");
    return;
};
```
