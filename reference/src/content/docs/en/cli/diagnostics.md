---
title: Compiler Diagnostics Guide
description: Complete catalog of static compiler error codes in FlexLang.
---

# Compiler Diagnostics Guide

The FlexLang compiler delivers clean, actionable error diagnostics with file paths, line/column coordinates, and contextual code underlines.

---

## 🗂️ Error Code Ranges

- **`E1xxx`**: Syntax, Lexer, and Module Loader errors
- **`E2xxx`**: Type, Exhaustiveness, and Signature errors
- **`E3xxx`**: Mutability, Move Semantics, and Memory Isolation violations

---

## 📋 Error Catalog

| Code | Description | Typical Cause |
|---|---|---|
| `E1001` | Syntax Parser Error | Unexpected token or missing closing delimiter |
| `E1005` | Circular Dependency Detected | Module A imports Module B which imports Module A |
| `E2001` | Type Mismatch | Assigning `Int` to a variable annotated as `String` |
| `E2010` | Non-Exhaustive `match` | Unhandled `enum` variant in pattern match block |
| `E2012` | Function Arity Mismatch | Passing 3 arguments to a function expecting 2 |
| `E2030` | Modulo Operator on Float | Using `%` on `Float` types |
| `E2034` | Dynamic Expression on `const` | Initializing a constant with a function call |
| `E2035` | `catch` on Non-Result Type | Applying `catch` to a non-Result expression |
| `E3001` | Mutation of Immutable Variable | Mutating fields or calling mutating methods on `let` |
| `E3002` | Use-After-Send of Moved Variable | Accessing a `mut` variable after sending it over a channel |
| `E3003` | Constant Reassignment | Attempting to mutate or reassign a `const` |
