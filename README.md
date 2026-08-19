<div align="center">
  <img src="https://raw.githubusercontent.com/pedro2s/flexlang/main/assets/octans-logo.svg" alt="FlexLang" width="120" height="120" />

  <h1>FlexLang</h1>
  <p><strong>The definitive programming language for Scalable, Safe, and High-Performance Backends.</strong></p>
  <p>
    <i>Clean syntax. Rigorous semantics. Zero Data Races. Native Go compilation.</i>
  </p>
  <p>
    <a href="https://pedro2s.github.io/flexlang/"><img src="https://img.shields.io/badge/docs-reference%20portal-00d2ff?style=flat-square&logo=astro" alt="Docs Portal" /></a>
    <a href="https://www.npmjs.com/package/@flexlang/cli"><img src="https://img.shields.io/npm/v/%40flexlang%2Fcli?style=flat-square&label=npm&color=blue" alt="npm version" /></a>
    <a href="https://github.com/pedro2s/flexlang/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/pedro2s/flexlang/ci.yml?branch=main&style=flat-square&label=tests" alt="Tests" /></a>
    <img src="https://img.shields.io/badge/target-Go%20%7C%20Node.js-informational?style=flat-square" alt="Targets" />
    <img src="https://img.shields.io/badge/license-ISC-green?style=flat-square" alt="License" />
  </p>
</div>

---

**FlexLang** was born from the need to unite developer ergonomics and rapid productivity (clear, familiar syntax) with strict memory safety and peak throughput for parallel backend systems handling heavy I/O workloads.

Forget *Callback Hell* and viral "function coloring" (`async/await`). In FlexLang, structured concurrency flows natively inspired by Go's battle-tested runtime, powered by modern transpilation that compiles verified source code directly into standalone, high-availability native Go binaries.

---

## ✨ Core Highlights & Philosophy

- **🔒 Immutability by Default:** Variables are immutable by default (`let`). Mutability (`let mut`) is explicit, tracked, and verified by the compiler.
- **⚡ Native Structured Concurrency:** Launch parallel green threads inside a `scope` using `spawn`. The compiler manages task lifecycles, structured error propagation, and synchronization.
- **🛡️ Eradication of Data Races:** Channels (`Channel.new()`) are the primary mechanism for cross-thread communication. When mutable state is transferred across channels (`send`), compiler-enforced *Move Semantics* revoke ownership at the origin (*Use-after-send* is strictly rejected at compile time).
- **🎯 Functional Error Handling:** No `null`, `nil`, or unhandled runtime exceptions. First-class `Result<T, E>` and `Option<T>` types with clean `?` propagation, static fallback blocks (`catch { ... }`), and exhaustive pattern matching via `match`.
- **🌐 Production-Grade Stdlib:** Native high-performance standard library modules including `net/http` (REST routing, path/query params, JSON parsing, timeout protection, automatic panic recovery), `db/postgres` (managed connection pools, parameterized queries `$1`, atomic transactions with auto-rollback), `math/decimal` (arbitrary-precision financial arithmetic), `core/time`, `core/log`, `crypto`, and `os/env`.
- **📦 Multi-File Local Module System:** Clean dependency imports (`import { OrderService } from "./services/order"`), cyclic dependency detection, and seamless single-binary compilation.
- **⚙️ Unified Developer CLI (`flex`):** One single binary for the entire development lifecycle — from rapid interpreted execution (`flex run`) and watch mode (`flex run --watch`) to native compilation (`flex build`) and golden-file testing (`flex test`).

---

## 🚀 Quick Start Guide

### Installation

Install the official CLI globally via your favorite package manager:

```bash
npm install -g @flexlang/cli
```

Or run directly without global installation using `npx`:

```bash
npx @flexlang/cli run path/to/file.flex
```

### CLI Commands Overview (`flex`)

```bash
# 1. Initialize a new project (generates flex.toml, entrypoint, and passing test)
flex init my-service
cd my-service

# 2. Run in interpreted mode (rapid iteration; auto-resolves local imports)
flex run src/main.flex

# 3. Run in watch mode (auto-reloads on file changes)
flex run --watch src/main.flex

# 4. Run test suite (recursively runs *_test.flex against golden *.out files)
flex test

# 5. Compile into a standalone native binary via Go (emits to ./build/)
flex build src/main.flex
./build/main

# 6. Check version and help
flex --version
flex --help
```

---

## 💻 Language Tour & Code Examples

### 1. Modern REST Server (`net/http`)

Deploy high-performance REST APIs with dynamic path parameters, typed JSON parsing, middleware chains, and automatic recovery:

```flexlang
import { Server, Request, Response } from "net/http";
import { log } from "core/log";

struct CreateUserDTO {
    name: String,
    role: String
}

func handle_create_user(req: Request, mut res: Response) {
    match req.json() {
        Result.Ok(dto) {
            log.info("user created", { name: dto.name, role: dto.role });
            res.status(201).json(dto);
        },
        Result.Err(msg) {
            log.error("invalid payload", { reason: msg });
            res.error(400, "Invalid JSON payload");
        }
    }
}

let mut server = Server.new(":8080");
server.post("/users", handle_create_user);

// Triggered gracefully before process shutdown (handles SIGINT / SIGTERM)
server.on_shutdown(|| {
    log.info("server shutting down gracefully", { status: "clean" });
});

print("🚀 Server online at http://localhost:8080");
server.start();
```

- **Built-in `GET /healthz`**: Automatically registered out-of-the-box for Kubernetes *Liveness* and *Readiness Probes*.
- **Panic Recovery**: Unhandled exceptions inside route handlers are caught on a per-request basis — returns a safe `500` status without crashing the process.
- **Structured JSON Logging**: `log.info` and `log.error` automatically mask sensitive fields (`password`, `token`, `secret`, `authorization`, `api_key`).

---

### 2. Native PostgreSQL Persistence (`db/postgres`)

Managed connection pooling, parameterized query protection against SQL injection, and ACID transactions:

```flexlang
import { Pool, Tx } from "db/postgres";

match Pool.connect("postgres://postgres:postgres@localhost:5432/postgres") {
    Result.Ok(pool) {
        // Safe parameterized query ($1)
        let rows = pool.query("SELECT id, name, balance FROM accounts WHERE balance >= $1", [500])?;
        
        // Atomic ACID transaction with auto-rollback
        pool.transaction(|tx: Tx| {
            tx.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [100, 1]);
            tx.execute("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [100, 2]);
        })?;

        pool.close();
    },
    Result.Err(err) {
        print("Failed to connect to database: ${err}");
    }
}
```

---

### 3. Structured Concurrency, Channels & *Move Semantics*

The static type checker guarantees zero data races by enforcing single-ownership transfers across threads:

```flexlang
struct TaskPayload {
    id: Int,
    content: String
}

func main() {
    let mut c = Channel.new();
    
    scope {
        spawn {
            let mut payload = TaskPayload { id: 1, content: "Safe concurrent processing" };
            c.send(payload); // 'payload' is MOVED. Accessing it here causes a compile-time Use-after-send error!
        }
        
        let received = c.recv();
        print("Received from green thread: ${received.content}");
    }
}

main();
```

---

### 4. Functional Error Handling (`Result` and `Option`)

Explicit domain error handling with generic sum types, `?` operator, and exhaustive matching:

```flexlang
struct User {
    id: Int,
    name: String
}

func find_user(id: Int) -> Option<User> {
    if id == 1 {
        return Option.Some(User { id: 1, name: "Alice" });
    }
    return Option.None;
}

func get_user_name(id: Int) -> Result<String, String> {
    match find_user(id) {
        Option.Some(u) {
            return Result.Ok(u.name);
        },
        Option.None {
            return Result.Err("User not found");
        }
    }
}
```

---

### 5. Multi-File Modular Architecture

Organize real-world enterprise applications into clean, maintainable architectural layers:

```flexlang
// File: services/order_service.flex
import { Order } from "../models/order";
import { find_order_by_id } from "../repository/order_repository";

func process_order(id: Int) -> Result<String, String> {
    let order = find_order_by_id(id)?;
    return Result.Ok("Order #${order.id} processed successfully!");
}
```

---

## 📚 Executable Examples Catalog

The [**`examples/`**](./examples/) directory contains ready-to-run reference implementations:

| Example | Description | Highlights |
| :--- | :--- | :--- |
| [**`01_hello_http.flex`**](./examples/01_hello_http.flex) | Web Server Hello World | `net/http` initialization and JSON response |
| [**`02_concurrency.flex`**](./examples/02_concurrency.flex) | Structured Concurrency | `scope`, `spawn`, `Channel`, and *Move Semantics* |
| [**`03_traits.flex`**](./examples/03_traits.flex) | Polymorphism & Traits | Strict interfaces and static implementation checks |
| [**`04_result_and_option.flex`**](./examples/04_result_and_option.flex) | Error Handling | `Result<T, E>`, `Option<T>`, `?` operator, pattern matching |
| [**`05_rest_api_http.flex`**](./examples/05_rest_api_http.flex) | Full REST API | Path parameters (`:id`), query params, HTTP status, and DTOs |
| [**`06_database_postgres.flex`**](./examples/06_database_postgres.flex) | PostgreSQL Database | Connection pooling, queries (`$1`), and ACID transactions |
| [**`07_multi_file_architecture/`**](./examples/07_multi_file_architecture/) | Layered Architecture | `models/`, `repository/`, `services/`, and `main.flex` entrypoint |
| [**`08_le_salvi_api/`**](./examples/08_le_salvi_api/) | Restaurant Order API | Comprehensive layered backend reference service |
| [**`09_flexbank_api/`**](./examples/09_flexbank_api/) | Fintech Banking API | Financial decimal math, JWT auth, PostgreSQL, and observability |

---

## 🧪 Testing Your FlexLang Project

Every project generated via `flex init` includes a pre-configured test suite (`tests/health_test.flex` + `tests/health_test.out`). `flex test` adheres to the **golden-file** testing convention:

```bash
flex test                          # Runs all *_test.flex recursively from current dir
flex test tests/                   # Limits search to a specific directory
flex test tests/health_test.flex   # Runs a single test file
```

- If a matching `.out` file does not exist, `flex test` **generates it automatically** on first run (`[GENERATED]`).
- Exits with non-zero status code (`exit 1`) on test failure, ready for CI/CD pipelines.

---

## 🛠️ Contributing & Compiler Development

```bash
# Clone and setup repository
git clone https://github.com/pedro2s/flexlang.git
cd flexlang
npm install

# Build the CLI bundle
npm run build

# Run the comprehensive test suite
npm test              # Internal golden-file tests (tests/)
npm run test:parity   # Go (compiled) vs. Node (interpreted) parity — RFC-001
npm run test:http     # Live HTTP integration test suite
npm run test:db       # Live PostgreSQL integration test suite
npm run test:flexbank # FlexBank Fintech enterprise integration tests
npm run test:vscode   # VSCode syntax grammar validation tests
```

---

## 📖 Documentation & Architecture

Explore our comprehensive documentation portal at **[https://pedro2s.github.io/flexlang/](https://pedro2s.github.io/flexlang/)** with full language tutorials, standard library references, architecture guides, and language comparisons.

- 📖 **[Architecture Roadmap (ADR-001)](./.docs/flexlang_architecture_roadmap.md)** — Compiler architecture and long-term design specifications.
- 📖 **[RFC Catalog (RFC-001 through RFC-029)](./.docs/v1/rfcs/)** — Formal specifications for language features, standard library, and runtime semantics.
- 📖 **[Release & Versioning Plan](./.docs/v1/release_plan.md)** — Semantic versioning and astronomical codename scheme.

---

<div align="center">
  <img src="https://raw.githubusercontent.com/pedro2s/flexlang/main/assets/octans-mascot.jpeg" alt="Octans, the FlexLang mascot" width="380" style="border-radius: 24px;" />
  <p><strong>Octans</strong> — the official FlexLang mascot, named after the southern constellation that also inspires our astronomical release codenames.</p>
  <p><i>"Make it simple, make it robust. Build with FlexLang."</i></p>
</div>
