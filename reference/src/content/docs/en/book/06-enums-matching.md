---
title: 6. Enums & Pattern Matching
description: Sum Types with positional payloads and exhaustive pattern matching with match.
---

In FlexLang, `enum` goes beyond simple integer lists — they are true **Sum Types (Tagged Unions)** that carry strongly typed data payloads inside variants.

---

## 📦 Declaring Enums With Payloads

Each enum variant can define positional payload parameters:

```flexlang
enum TransactionStatus {
    Pending,
    Approved(String),      // Carries receipt ID (String)
    Rejected(Int, String)  // Carries error code (Int) and reason (String)
}
```

### Instantiating Variants
```flexlang
let t1 = TransactionStatus.Pending;
let t2 = TransactionStatus.Approved("AUTH_891230");
let t3 = TransactionStatus.Rejected(402, "Insufficient balance");
```

---

## 🎯 Pattern Matching via `match`

The `match` statement safely destructures enums and binds payload arguments:

```flexlang
func process(status: TransactionStatus) {
    match status {
        TransactionStatus.Pending {
            print("Pending processing...");
        },
        TransactionStatus.Approved(receipt) {
            print("Transaction approved! Receipt: ");
            print(receipt);
        },
        TransactionStatus.Rejected(code, reason) {
            print("Transaction rejected with code: ");
            print(code);
            print(reason);
        }
    }
}
```

---

## 🛡️ Static Exhaustiveness Checking

The compiler strictly requires that **every enum variant is explicitly handled**. Forgetting a variant triggers error `E2010`:

```flexlang
// If TransactionStatus adds a 'Cancelled' variant:
// COMPILATION ERROR E2010: match is not exhaustive, missing variant 'Cancelled'
```

This ensures that enterprise domain refactorings are compiler-guaranteed against missing branches.
