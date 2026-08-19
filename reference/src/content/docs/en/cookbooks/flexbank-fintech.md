---
title: "Case Study: FlexBank API"
description: Building an enterprise Fintech Banking API with FlexLang, Decimal, PostgreSQL, Auth, and Observability.
---

# Case Study: FlexBank API (Fintech)

The **FlexBank API** (`examples/09_flexbank_api`) is FlexLang's enterprise reference application. It showcases how to build a robust, secure, and binary-rounding-free banking service.

---

## 🏛️ Project Architecture

```text
examples/09_flexbank_api/
├── flex.toml
├── src/
│   ├── main.flex                # HTTP Server bootstrap and global middlewares
│   ├── config/settings.flex     # Typed environment configuration
│   ├── database/db.flex         # PostgreSQL Pool and migrations
│   ├── models/                  # Struct entities (Account, Transaction, Auth)
│   ├── routes/                  # REST Controllers (auth, accounts, transfers)
│   ├── services/
│   │   ├── transfer_service.flex # ACID Transfer business logic
│   │   └── interest_service.flex # Compound interest calculations via Decimal
│   ├── middlewares/auth.flex    # Token authentication middleware
│   └── traits/auditable.flex    # Audit trait contract
```

---

## 🔑 Key Implementation Highlights

### 1. Financial Math via `math/decimal`
```flexlang
import { Decimal } from "math/decimal";

func process_transfer(mut src: Account, mut dest: Account, amount: Decimal) -> Result<Void, String> {
    if src.balance.equals(amount) == false && src.balance.sub(amount).is_negative() {
        return Result.Err("Insufficient funds for transfer");
    }

    src.balance = src.balance.sub(amount);
    dest.balance = dest.balance.add(amount);

    return Result.Ok(Void);
}
```

### 2. Secure Authentication via `crypto`
```flexlang
import { hash, uuid } from "crypto";

func authenticate(email: String, plain_pass: String) -> Result<String, String> {
    let user = repo.find_by_email(email)?;
    
    if hash.bcrypt_verify(plain_pass, user.password_hash) == false {
        return Result.Err("Invalid credentials");
    }

    let token = uuid.v4();
    return Result.Ok(token);
}
```

### 3. Failure Handling via `catch`
```flexlang
let statement = service.generate_statement(account_id) catch err {
    log.error("Failed generating statement", { account: account_id, error: err });
    res.error(500, "Internal error processing bank statement");
    return;
};
```
