---
title: 8. Structured Concurrency & Channels
description: Lightweight green threads, structured concurrency scopes, rendezvous channels, and mutability isolation.
---

FlexLang is engineered to handle millions of concurrent connections with minimal memory overhead, preventing task leaks by design.

---

## 🧵 Green Threads and `scope`

In FlexLang, **there are no orphan spawns**. Every concurrent task is strictly bounded by an enclosing `scope { ... }`:

```flexlang
scope {
    spawn {
        print("Concurrent task A running...");
    }

    spawn {
        print("Concurrent task B running...");
    }
}
// Execution reaches this line only after ALL child tasks finish.
print("All tasks finished successfully!");
```

---

## ⏱️ Automatic Deadlines and Timeouts

Scopes can enforce deadlines:

```flexlang
import { Duration } from "core/time";

scope(deadline: Duration.from_millis(200)) {
    spawn {
        query_slow_downstream_service();
    }
}
// If the task exceeds 200ms, it is cancelled automatically.
```

---

## 📬 Typed Channels (`Channel.new()`)

Channels provide synchronous rendezvous communication between green threads:

```flexlang
let ch = Channel.new();

scope {
    spawn {
        let data = compute_report();
        ch.send(data); // Send to channel
    }

    spawn {
        let result = ch.recv(); // Block until received
        print("Result received: ${result}");
    }
}
```

---

## 🔒 Mutability Isolation (*Move Semantics*)

Sending a `mut` variable across a channel **moves** ownership to the receiving thread:

```flexlang
let mut buffer = [1, 2, 3];

scope {
    spawn {
        ch.send(buffer);
        // buffer is MOVED!
        // buffer.push(4); // STATIC ERROR: Use-after-send of moved variable 'buffer'
    }
}
```

This static rule eliminates data races at compile-time without complex lifetime annotations.
