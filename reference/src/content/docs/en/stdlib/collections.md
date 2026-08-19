---
title: Collections & Native Methods
description: High-performance utility methods for Strings, Arrays, and HashMaps.
---

# Collections & Native Methods

FlexLang provides an extensive set of built-in methods for working with text, arrays, and maps.

---

## 🔤 String Methods

```flexlang
let text = "  FlexLang Backend  ";

text.len();                       // 20
text.trim();                      // "FlexLang Backend"
text.to_lowercase();              // "  flexlang backend  "
text.to_uppercase();              // "  FLEXLANG BACKEND  "
text.contains("Backend");         // true
text.starts_with("  Flex");       // true
text.ends_with("end  ");          // true
text.replace("Backend", "Core");  // "  FlexLang Core  "
text.substring(2, 10);            // "FlexLang"
text.index_of("Lang");            // 6 (or -1 if missing)
"a,b,c".split(",");               // ["a", "b", "c"]
```

---

## 📋 Array Methods

```flexlang
let mut numbers = [10, 20, 30];

numbers.len();                  // 3
numbers.is_empty();             // false
numbers.contains(20);           // true

// Mutations on mutable arrays
numbers.push(40);               // [10, 20, 30, 40]
let last = numbers.pop();       // 40

// Slicing & Concatenation
let sub = numbers.slice(0, 2);  // [10, 20]
let merged = numbers.concat([99, 100]);

// Functional Methods with Closures
let doubled = numbers.map(|n| { return n * 2; });
let filtered = numbers.filter(|n| { return n > 15; });
```

---

## 🗺️ `HashMap` Methods

```flexlang
// Constructors
let mut map = HashMap.new();
let config = HashMap.from({
    "host": "localhost",
    "port": "8080"
});

// Operations
map.set("key", "value");
let val = map.get("key");            // Option.Some("value")
map.contains_key("key");             // true
map.len();                           // 1
map.is_empty();                      // false

let keys = map.keys();               // ["key"]
let values = map.values();           // ["value"]

let removed = map.remove("key");     // Option.Some("value")
```
