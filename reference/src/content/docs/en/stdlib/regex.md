---
title: std/regex — RE2 Regular Expressions
description: Linear O(n) regular expressions engine with complete immunity against ReDoS attacks.
---

The `std/regex` module provides safe regular expressions backed by the RE2 engine in native Go compilation, guaranteeing $O(n)$ time complexity regardless of input size.

```flexlang
import { regex, Regex, MatchResult } from "std/regex";
```

---

## 🎯 1. Fast Pattern Matching (`is_match`)

```flexlang
let match_res = regex.is_match("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", "alice@flexbank.dev");
match match_res {
    Result.Ok(is_valid) {
        print("Valid email: ${is_valid}");
    },
    Result.Err(err) {
        print("Regex error: ${err}");
    }
}
```

---

## 🔍 2. Compiled `Regex`

```flexlang
let re = regex.compile("(?P<area>\\d{2})-(?P<num>\\d{4,5}-\\d{4})")?;

if (re.matches("11-99812-3456")) {
    print("Valid phone");
}

let match_opt = re.find("Call: 11-99812-3456");
let sanitized = re.replace_all("11-99812-3456, 21-98765-4321", "[PHONE]");
let items = regex.compile(",")?.split("apple,banana,orange");
```
