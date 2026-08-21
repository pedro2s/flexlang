---
title: storage/redis — Native Redis Driver
description: High-performance Redis connection pooling, key-value operations, hashes, TTL, and distributed locks with Lua scripts.
---

The `db/redis` module (also available as `storage/redis`) provides a native Redis driver with connection pooling, caching primitives, TTL expiration, and atomic distributed locking with `RedisLock`.

```flexlang
import { Redis, RedisConfig, RedisLock } from "storage/redis";
import { Duration } from "core/time";
```

---

## 🚀 1. Key-Value & Caching

```flexlang
let client = Redis.connect(RedisConfig {
    host: "localhost",
    port: 6379,
    password: Option.None,
    db: 0,
    max_pool_size: 10,
    connect_timeout: Duration.seconds(2)
})?;

// Set with TTL
client.set_ex("session:usr_alice", "{\"logged\":true}", Duration.seconds(3600))?;

// Get
let session_opt = client.get("session:usr_alice")?;
client.incr("counter:requests")?;
client.del("temp_cache_key")?;
```

---

## 🔒 2. Atomic Distributed Locking (`RedisLock`)

```flexlang
let lock_res = client.acquire_lock("lock:settlement:tx_9918", Duration.seconds(10));
match lock_res {
    Result.Ok(lock) {
        // Critical section...
        lock.release();
    },
    Result.Err(e) {
        print("Resource is locked by another instance: ${e}");
    }
}
```
