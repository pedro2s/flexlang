---
title: db/postgres — PostgreSQL Driver
description: Connection pools, 100% parameterized queries, ACID transactions, and struct mapping.
---

The `db/postgres` module provides high-throughput transactional access to PostgreSQL with native SQL injection prevention via mandatory parameterized statements.

```flexlang
import { Pool } from "db/postgres";
```

---

## 🔌 Connecting to PostgreSQL (`Pool.connect`)

```flexlang
import { env } from "os/env";

let db_url = env.require("DATABASE_URL");
let pool = Pool.connect(db_url)?;
```

---

## 🔎 Parameterized Queries

FlexLang mandates positional placeholders (`$1`, `$2`, ...) to protect against injection vulnerabilities.

### 1. Querying Multiple Records (`query`)
```flexlang
struct User {
    id: Int,
    name: String,
    email: String
}

let users: [User] = pool.query(
    "SELECT id, name, email FROM users WHERE is_active = $1 ORDER BY id ASC",
    [true]
)?;

for user in users {
    print("User: ${user.name} (${user.email})");
}
```

### 2. Querying a Single Record (`query_one`)
Returns `Result<T, String>`. If no record matches, it returns `Result.Err("record not found")`:

```flexlang
let user_id = 42;
let user: User = pool.query_one(
    "SELECT id, name, email FROM users WHERE id = $1",
    [user_id]
)?;
```

### 3. Executing Mutations (`execute`)
For `INSERT`, `UPDATE`, and `DELETE` commands. Returns the count of affected rows:

```flexlang
let affected_rows = pool.execute(
    "UPDATE users SET is_active = $1 WHERE id = $2",
    [false, 42]
)?;

print("Updated rows: ${affected_rows}");
```

---

## 🏦 ACID Transactions (`pool.transaction`)

Execute atomic operations in a single transaction block. Returning `Result.Err` automatically triggers a `ROLLBACK`:

```flexlang
let result = pool.transaction(|tx| {
    tx.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [100, "acc_a"])?;
    tx.execute("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [100, "acc_b"])?;
    
    return Result.Ok("Transfer completed");
});
```

---

## 🛑 Closing Connections (`pool.close`)

```flexlang
pool.close();
```
