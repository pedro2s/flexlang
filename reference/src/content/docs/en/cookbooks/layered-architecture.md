---
title: Layered Architecture (Le Salvi API)
description: Layered architecture patterns with Routes, Services, Repositories, and Traits.
---

The **Le Salvi API** (`examples/08_le_salvi_api`) showcases the recommended separation of concerns for enterprise FlexLang backends.

---

## 📐 Application Layers

1. **Routes (HTTP Controllers)**: Accept requests, parse path/body parameters, and reply via `res.json()`.
2. **Services (Business Logic)**: Handle domain rules, workflows, and structured concurrency (`scope`/`spawn`).
3. **Repositories (Data Access)**: Execute parameterized SQL statements via `db/postgres`.
4. **Traits (Interfaces & Contracts)**: Decouple domain services from infrastructure adapters.

---

## 💡 Layered Flow Example

### Billing Trait Contract (`src/traits/billing.flex`)
```flexlang
trait BillingProcessor {
    func charge(self, customer_id: String, amount: Float) -> Result<String, String>;
}
```

### Domain Service (`src/services/notifications.flex`)
```flexlang
import { BillingProcessor } from "../traits/billing";

struct BookingService {
    gateway: BillingProcessor
}

impl BookingService {
    func confirm_booking(self, customer_id: String, amount: Float) -> Result<String, String> {
        let receipt = self.gateway.charge(customer_id, amount)?;
        return Result.Ok("Booking confirmed with receipt ${receipt}");
    }
}
```
