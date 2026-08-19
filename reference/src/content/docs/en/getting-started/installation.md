---
title: Installation in 60 Seconds
description: Install the FlexLang compiler and CLI toolchain.
---

The unified `flex` CLI provides everything you need: compiler, interpreter, test runner, and Go build toolchain integration.

---

## ⚡ Prerequisites

1. **Node.js**: Version 18 or later (Node 20+ or 22 LTS recommended).
2. **Go (Optional, for `flex build`)**: Version 1.22+ if you plan to compile native binaries via `flex build`. For interpreted development via `flex run`, Node.js alone is sufficient.

---

## 📦 Installation via Package Managers

Install the CLI globally using your favorite package manager:

### npm (Default)
```bash
npm install -g @flexlang/cli
```

### pnpm
```bash
pnpm add -g @flexlang/cli
```

### yarn
```bash
yarn global add @flexlang/cli
```

### bun
```bash
bun add -g @flexlang/cli
```

---

## ✅ Verifying Your Installation

Confirm that `flex` is available in your PATH:

```bash
flex --help
```

You should see the CLI usage menu:

```text
🚀 FlexLang CLI

Usage:
  flex init <name>               - Creates a new FlexLang project
  flex run [file.flex]           - Interprets and runs the file (or entry from flex.toml)
  flex run --watch [file.flex]   - Runs in watch mode, reloading on any file changes
  flex build [file.flex]         - Transpiles to Go and compiles to a native binary
  flex test [path]               - Runs golden file tests (matches *_test.flex)
```

---

## 🔄 Upgrading to the Latest Version

To update your installation to the latest stable release:

```bash
npm install -g @flexlang/cli@latest
```
