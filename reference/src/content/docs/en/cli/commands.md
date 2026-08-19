---
title: CLI Commands (flex)
description: Complete reference for all subcommands and flags in the official FlexLang CLI.
---

The `flex` command-line interface provides unified project management, execution, testing, and compilation.

---

## 📋 Subcommand Reference

### 1. `flex init <name>`
Scaffolds a new FlexLang project with `flex.toml`, `src/main.flex`, module handlers, and test fixtures:

```bash
flex init my-backend
```

---

### 2. `flex run [file.flex]`
Runs in rapid asynchronous interpreted mode. If no file is passed, it uses the `entry` field from `flex.toml`:

```bash
flex run
# or with an explicit path:
flex run src/main.flex
```

#### Flag `--watch` (or `-w`)
Automatically restarts the application on any file changes across the project's dependency graph:

```bash
flex run --watch
```

---

### 3. `flex build [file.flex]`
Transpiles FlexLang code to Go and compiles an optimized native binary inside the `build/` directory:

```bash
flex build
```

The compiled binary will be placed at:
```bash
./build/main
```

---

### 4. `flex test [path]`
Discovers and runs all golden test suites (`*_test.flex`):

```bash
flex test
# or against a specific directory:
flex test tests/
```

---

### 5. `flex --help` and `flex --version`
Displays CLI help usage and installed compiler version.
