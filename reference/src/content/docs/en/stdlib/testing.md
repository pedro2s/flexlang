---
title: std/testing — Native Unit Testing Framework
description: Native unit testing framework with #[test] annotations, deep structural equality assertions, and flex test CLI runner.
---

The `std/testing` module is FlexLang's built-in unit testing framework (RFC-041). It allows writing mission-critical test suites using declarative `#[test]` function attributes, deep structural equality assertions, and isolated execution via the `flex test` CLI in both interpreted and native Go (`--native`) modes.

```flexlang
import { testing } from "std/testing";
```

---

## 🧪 1. Test File Structure

Test functions must:
1. Include the `#[test]` attribute and/or the `test_` prefix.
2. Be placed in files ending with `_test.flex` or inside the `tests/` directory.

### Example

```flexlang
// tests/math_test.flex
import { testing } from "std/testing";
import { Decimal } from "math/decimal";

#[test]
func test_decimal_addition() {
    let a = Decimal.new("0.1");
    let b = Decimal.new("0.2");
    let c = a.add(b);

    testing.assert_eq(c.to_string(), "0.3", "Decimal arithmetic failed");
}

#[test]
func test_boolean_conditions() {
    testing.assert_true(10 > 5, "10 should be greater than 5");
    testing.assert_false(2 == 3, "2 cannot equal 3");
    testing.assert_neq("key_a", "key_b", "Keys must differ");
}

#[test]
func test_result_and_option_unpacking() {
    // 1. Unpacks Result.Ok value
    let res = Result.Ok(500);
    let val = testing.assert_ok(res, "Expected Ok");
    testing.assert_eq(val, 500, "");

    // 2. Unpacks Result.Err message
    let res_err = Result.Err("insufficient_funds");
    let err_msg = testing.assert_err(res_err, "Expected Err");
    testing.assert_eq(err_msg, "insufficient_funds", "");

    // 3. Option assertions
    let opt = Option.Some("alice");
    let name = testing.assert_some(opt, "Expected Some");
    testing.assert_eq(name, "alice", "");

    testing.assert_none(Option.None, "Expected None");
}
```

---

## 📋 2. Assertions Reference (`std/testing`)

| Assertion | Signature | Return | Description |
|---|---|---|---|
| `assert_eq` | `testing.assert_eq(actual, expected, msg?)` | `Void` | Validates deep structural equality across primitives, maps, arrays, and enums. |
| `assert_neq` | `testing.assert_neq(actual, expected, msg?)` | `Void` | Validates that two values differ. |
| `assert_true` | `testing.assert_true(condition, msg?)` | `Void` | Asserts that boolean condition is `true`. |
| `assert_false` | `testing.assert_false(condition, msg?)` | `Void` | Asserts that boolean condition is `false`. |
| `assert_ok` | `testing.assert_ok(result, msg?)` | `T` | Asserts `Result.Ok(T)` and **unpacks the contained value `T`**. |
| `assert_err` | `testing.assert_err(result, msg?)` | `E` | Asserts `Result.Err(E)` and **unpacks the contained error `E`**. |
| `assert_some` | `testing.assert_some(option, msg?)` | `T` | Asserts `Option.Some(T)` and **unpacks the contained value `T`**. |
| `assert_none` | `testing.assert_none(option, msg?)` | `Void` | Asserts that value is `Option.None`. |

---

## 🚀 3. CLI Execution (`flex test`)

The `flex test` command automatically discovers all test files and runs each `#[test]` function in complete isolation.

```bash
# 1. Run all tests in interpreted mode (fast local development)
flex test

# 2. Run a specific test suite file or directory
flex test tests/math_test.flex
flex test tests/

# 3. Native Go mode (validates ADR-001 Parity Gate)
flex test --native (-n)
```
