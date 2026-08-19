---
title: core/time — Time & Durations
description: UTC timestamps, ISO 8601 formatting, Unix epochs, and duration calculations.
---

The `core/time` module handles UTC timestamps and interval calculations (*Duration*).

```flexlang
import { Time, Duration } from "core/time";
```

---

## ⏰ `Time` API

| Method | Signature | Return | Description |
|---|---|---|---|
| `Time.now` | `Time.now()` | `Time` | Returns current UTC timestamp. |
| `Time.parse` | `Time.parse(iso: String)` | `Result<Time, String>` | Parses an ISO 8601 string. |
| `Time.from_unix` | `Time.from_unix(secs: Int)` | `Time` | Creates Time from Unix epoch seconds. |
| `to_iso_string` | `t.to_iso_string()` | `String` | Formats as `2026-08-18T10:00:00.000Z`. |
| `unix_timestamp` | `t.unix_timestamp()` | `Int` | Returns seconds since epoch. |
| `unix_millis` | `t.unix_millis()` | `Int` | Returns milliseconds since epoch. |
| `add` | `t.add(d: Duration)` | `Time` | Adds duration to timestamp. |
| `sub` | `t.sub(other: Time)` | `Duration` | Computes time elapsed between two timestamps. |

---

## ⏳ `Duration` API

| Method | Signature | Description |
|---|---|---|
| `Duration.from_seconds` | `Duration.from_seconds(s: Int)` | Creates duration in seconds. |
| `Duration.from_millis` | `Duration.from_millis(ms: Int)` | Creates duration in milliseconds. |
| `Duration.from_minutes` | `Duration.from_minutes(m: Int)` | Creates duration in minutes. |
| `Duration.from_hours` | `Duration.from_hours(h: Int)` | Creates duration in hours. |

---

## 💡 Example: Session Expiration

```flexlang
func session_expires_at() -> String {
    let now = Time.now();
    let ttl = Duration.from_hours(24);
    let expires = now.add(ttl);

    return expires.to_iso_string();
}
```
