---
title: Your First Project in 5 Minutes
description: Create, test, run, and compile your first FlexLang application.
---

# Your First Project in 5 Minutes

In this guide, you will scaffold a new FlexLang project, explore its structure, run automated tests, and compile a native binary.

---

## 1. Creating the Project via `flex init`

Run `flex init` with your project's name:

```bash
flex init my-first-app
cd my-first-app
```

The CLI scaffolds a complete and organized project:

```text
my-first-app/
├── flex.toml                # Project manifest and compiler target version
├── src/
│   ├── main.flex            # Main entry point
│   ├── modules/
│   │   └── health/
│   │       └── handler.flex # Example module handler
│   └── shared/
└── tests/
    ├── health_test.flex     # Golden test file
    └── health_test.out      # Expected golden output
```

---

## 2. The `flex.toml` Manifest

Open `flex.toml`:

```toml
[package]
name = "my-first-app"
version = "0.1.0"
entry = "src/main.flex"
flex_version = "0.3.0"
```

The `entry` field defines the root file executed when you run `flex run` without arguments. The `flex_version` field enforces compiler compatibility.

---

## 3. Running in Development Mode (`flex run`)

Execute the project locally:

```bash
flex run
```

Output:
```text
[flex] Running /path/my-first-app/src/main.flex in interpreted mode...

Starting my-first-app...
Health: OK
```

### Live Watch Mode
During development, pass `--watch` (or `-w`) to automatically reload on any file change across your dependency graph:

```bash
flex run --watch
```

---

## 4. Running Automated Tests (`flex test`)

FlexLang comes with a built-in test runner using *Golden File Testing*:

```bash
flex test
```

Output:
```text
Running 1 test(s)...

[PASS] health_test.flex

Tests Completed: 1 passed, 0 failed.
```

---

## 5. Compiling a Native Production Binary (`flex build`)

To generate an optimized native binary:

```bash
flex build
```

The compiler transpilates your code to Go and produces the compiled executable in `build/`:

```bash
./build/main
```

Congratulations! You have scaffolded, tested, and compiled your first native FlexLang application.
