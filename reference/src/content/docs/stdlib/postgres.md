---
title: db/postgres — Driver PostgreSQL Nativo
description: Pool de conexões, queries 100% parametrizadas, transações ACID e mapeamento de tipos.
---

O módulo `db/postgres` provê acesso transacional de alta performance ao banco PostgreSQL com proteção nativa contra SQL Injection via consultas parametrizadas obrigatórias.

```flexlang
import { Pool } from "db/postgres";
```

---

## 🔌 Conectando ao Banco (`Pool.connect`)

```flexlang
import { env } from "os/env";

let db_url = env.require("DATABASE_URL");
let pool = Pool.connect(db_url)?;
```

---

## 🔎 Consultas Parametrizadas

A FlexLang exige o uso de placeholders posicionais (`$1`, `$2`, ...) para evitar injeção de código malicioso.

### 1. Consultando Múltiplas Linhas (`query`)
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
    print("Usuário: ${user.name} (${user.email})");
}
```

### 2. Consultando uma Única Linha (`query_one`)
Retorna `Result<T, String>`. Se nenhum registro for encontrado, retorna `Result.Err("record not found")`:

```flexlang
let user_id = 42;
let user: User = pool.query_one(
    "SELECT id, name, email FROM users WHERE id = $1",
    [user_id]
)?;
```

### 3. Executando Modificações (`execute`)
Para comandos `INSERT`, `UPDATE` e `DELETE`. Retorna a quantidade de linhas afetadas:

```flexlang
let linhas_afetadas = pool.execute(
    "UPDATE users SET is_active = $1 WHERE id = $2",
    [false, 42]
)?;

print("Linhas atualizadas: ${linhas_afetadas}");
```

---

## 🏦 Transações ACID (`pool.transaction`)

Execute múltiplas operações em um bloco atômico. Se o callback retornar `Result.Err`, um `ROLLBACK` é acionado automaticamente:

```flexlang
let resultado = pool.transaction(|tx| {
    tx.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [100, "acc_a"])?;
    tx.execute("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [100, "acc_b"])?;
    
    return Result.Ok("Transferência realizada");
});
```

---

## 🛑 Fechando Conexões (`pool.close`)

```flexlang
pool.close();
```
