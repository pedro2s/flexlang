---
title: storage/redis — Driver Redis Nativo
description: Conexão de alta performance com Redis, operações de chave-valor, hashes, TTL e locks distribuídos com scripts Lua.
---

O módulo `db/redis` (também importável como `storage/redis`) implementa um driver nativo de alta performance para Redis com suporte a connection pooling, operações de cache, expiração atômica e **locks distribuídos com `RedisLock`**.

```flexlang
import { Redis, RedisConfig, RedisLock } from "storage/redis";
import { Duration } from "core/time";
```

---

## 🚀 1. Conexão e Operações Chave-Valor

```flexlang
let client_res = Redis.connect(RedisConfig {
    host: "localhost",
    port: 6379,
    password: Option.None,
    db: 0,
    max_pool_size: 10,
    connect_timeout: Duration.seconds(2)
});
let client = client_res?;

// Set com expiração atômica (PX em milissegundos)
client.set_ex("session:usr_alice", "{\"logged\":true}", Duration.seconds(3600))?;

// Leitura retornando Option
let session_res = client.get("session:usr_alice")?;
match session_res {
    Option.Some(data) {
        print("Sessão ativa: ${data}");
    },
    Option.None {
        print("Sessão expirada ou chave inexistente");
    }
}

// Incremento e Deleção
client.incr("counter:page_views")?;
client.del("temp_cache_key")?;
```

---

## 🔒 2. Lock Distribuído Atômico (`RedisLock`)

Garante exclusão mútua distribuída entre microsserviços. A liberação utiliza scripts Lua garantindo que apenas o detentor do lock possa liberá-lo.

```flexlang
let lock_res = client.acquire_lock("lock:settlement:tx_9918", Duration.seconds(10));
match lock_res {
    Result.Ok(lock) {
        print("Lock distribuído adquirido com sucesso");
        
        // Execução da seção crítica protegida...

        // Liberação segura do lock
        lock.release();
    },
    Result.Err(e) {
        print("Recurso ocupado por outro worker: ${e}");
    }
}
```
