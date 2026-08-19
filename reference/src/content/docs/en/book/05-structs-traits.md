---
title: 5. Structs, Methods & Traits
description: Data modeling with structs, behavior with impl blocks, and polymorphic traits.
---

# Structs, Methods & Traits

FlexLang cleanly decouples **data** (stored in `struct`) from **behavior** (defined in `impl` and `trait` blocks), promoting clean architecture without class inheritance pitfalls.

---

## 🏗️ Data Structures (`struct`)

Structs group named and typed fields:

```flexlang
struct User {
    id: Int,
    name: String,
    email: String,
    is_active: Bool
}

// Instantiation
let alice = User {
    id: 1,
    name: "Alice",
    email: "alice@company.com",
    is_active: true
};
```

---

## 🛠️ Struct Methods (`impl Struct`)

Methods are associated with structs via `impl` blocks. The receiver is indicated by `self` (immutable) or `mut self` (mutates internal state):

```flexlang
struct Cart {
    total: Float,
    items: Int
}

impl Cart {
    func add_item(mut self, price: Float) {
        self.total = self.total + price;
        self.items = self.items + 1;
    }

    func summary(self) -> String {
        return "Cart with ${self.items} items, Total: $ ${self.total}";
    }
}

let mut my_cart = Cart { total: 0.0, items: 0 };
my_cart.add_item(49.90);
print(my_cart.summary());
```

---

## 🎭 Traits (Nominal Interfaces)

Traits specify behavioral contracts that any struct can fulfill:

```flexlang
trait Notifiable {
    func send(self, message: String) -> Bool;
}

struct EmailService {
    smtp_host: String
}

impl Notifiable for EmailService {
    func send(self, message: String) -> Bool {
        print("Sending via SMTP (${self.smtp_host}): ${message}");
        return true;
    }
}
```

### Static Trait Conformance Checking
FlexLang's **Type Checker** statically verifies that the implementing struct satisfies every method signature, parameter type, and return type declared on the trait.
