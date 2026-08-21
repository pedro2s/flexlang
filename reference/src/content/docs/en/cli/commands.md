---
title: CLI Commands (flex)
description: Complete reference for all subcommands and flags in the official FlexLang CLI.
---

The `flex` CLI is the unified toolchain to initialize, develop, test, type-check, and compile native FlexLang applications.

---

## 📋 Subcommands

### 1. `flex init <name>`
Creates a new structured FlexLang project with `flex.toml`, `src/main.flex`, and test suites:

```bash
flex init my-backend
```

---

### 2. `flex run [file.flex]`
Runs the project in interpreted mode with instant feedback:

```bash
flex run
flex run src/main.flex
flex run --watch # Hot reload
```

---

### 3. `flex test [path] [flags]`
Discovers and executes unit test suites in `*_test.flex` files:

```bash
flex test
flex test --verbose (-v)
flex test --filter "Auth" (-f "Auth")
flex test --native (-n)
```

---

### 4. `flex build [file.flex]`
Transpiles FlexLang AST to Go and compiles an optimized native binary in `build/`:

```bash
flex build
```

---

### 5. `flex check [file.flex]`
Runs static type checking across the entire module graph without executing the program:

```bash
flex check
```
