---
title: 1. Variables, Mutability & Const
description: Master let, let mut, const, and FlexLang's mutability isolation model.
---

In FlexLang, memory safety and data-race freedom start directly at variable declarations.

---

## 🔒 Immutability by Default (`let`)

Every variable declared with `let` is strictly immutable by default:

```flexlang
let port = 8080;
let host = "localhost";

// Compilation Error: Cannot reassign immutable variable
// port = 9000;
```

Type inference automatically deduces variable types, but explicit annotations are fully supported:

```flexlang
let max_connections: Int = 100;
let app_name: String = "FlexBank";
let is_active: Bool = true;
```

---

## ✏️ Explicit Mutability (`let mut`)

When you need to mutate a variable or update struct properties, declare it explicitly using `mut`:

```flexlang
let mut counter = 0;
counter = counter + 1;
print(counter); // Prints: 1
```

### Mutability in Structs
Mutability is enforced from the root variable:

```flexlang
struct User {
    id: Int,
    name: String
}

let mut user = User { id: 1, name: "Alice" };
user.name = "Bob"; // OK: 'user' is declared as mutable

let static_user = User { id: 2, name: "Carlos" };
// static_user.name = "Daniel"; // STATIC ERROR: 'static_user' is immutable
```

---

## 🛡️ Module-Level Constants (`const`)

Constants are declared with `const` at top-level scope. They are evaluated at compile-time with absolute immutability:

```flexlang
const MAX_RETRIES = 3;
const TAX_RATE = 0.15;
const DEFAULT_TIMEOUT_MS = 5000;
const BANK_NAME = "FlexBank S.A.";
```

### `const` Rules:
1. **Literals Only**: Function calls and dynamic expressions are rejected.
2. **Absolute Immutability**: Any reassignment attempt triggers static compiler error `E3003`.
3. **Module Scope**: Ideal for system limits, fixed rates, and static configuration.
