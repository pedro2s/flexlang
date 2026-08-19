---
title: 3. Control Flow
description: Master if, else if, while, for..in, and loop control in FlexLang.
---

# Control Flow

FlexLang provides clean, concise, and predictable control flow constructs.

---

## 🔀 Conditionals: `if`, `else if`, and `else`

Conditionals do not require parentheses around expressions:

```flexlang
let score = 85;

if score >= 90 {
    print("Excellent! Grade A");
} else if score >= 80 {
    print("Very Good! Grade B");
} else if score >= 70 {
    print("Good! Grade C");
} else {
    print("Needs Improvement");
}
```

---

## 🔁 Iteration: `for..in` on Collections

The `for..in` loop iterates over arrays, numeric ranges, and `HashMap` entries:

### Iterating Over Arrays
```flexlang
let fruits = ["Mango", "Banana", "Pineapple"];

for fruit in fruits {
    print("Fruit: ${fruit}");
}
```

### Iterating Over Ranges
```flexlang
for i in 1..5 {
    print("Count: ${i}"); // Prints 1 through 4
}
```

### Iterating Over HashMaps (Key & Value)
```flexlang
let capitals = HashMap.from({
    "BR": "Brasilia",
    "PT": "Lisbon",
    "US": "Washington"
});

for country, capital in capitals {
    print("Country: ${country} -> Capital: ${capital}");
}
```

---

## 🔄 `while` Loops

The `while` loop executes while a predicate evaluates to `true`:

```flexlang
let mut i = 0;
while i < 5 {
    print("Iteration: ${i}");
    i = i + 1;
}
```

---

## ⏹️ `break` and `continue`

Interrupt or skip iterations in both `while` and `for` loops:

```flexlang
for n in 1..10 {
    if n % 2 == 0 {
        continue; // Skip even numbers
    }
    if n > 7 {
        break; // Exit loop early
    }
    print("Odd: ${n}");
}
```
