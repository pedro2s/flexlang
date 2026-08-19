---
title: Overview & Philosophy
description: Discover the design principles and core objectives behind FlexLang.
---

# Overview & Philosophy of FlexLang

**FlexLang** is a compiled, statically-typed programming language designed from day one to address the real-world challenges of building **modern, highly concurrent, and financially critical backends**.

---

## 🎯 The 4 Core Design Pillars

### 1. "A Go With a Better Type System"
The Go ecosystem demonstrated that a lightweight runtime with green threads (goroutines), low-pause garbage collection, and fast compilation is ideal for network services. However, the lack of sum types (`enum` with payloads), repetitive `if err != nil` error handling, and the absence of immutability by default introduce fragility in enterprise systems.

FlexLang inherits Go's execution power while delivering:
- **First-Class `Result<T, E>` and `Option<T>`**: Errors are explicit values in the type system.
- **Exhaustive Pattern Matching**: The compiler prevents unhandled error cases.
- **Propagation Operator `?` and `catch` Blocks**: Concise syntax to propagate or catch errors with inline fallback.

### 2. Structured Concurrency by Default
In traditional languages, spawning a background thread or goroutine risks task leaks and complicates cancellation when requests timeout.

In FlexLang:
- **No Orphan Spawns**: Every green thread lives inside a `scope { ... }` block.
- **Hierarchical Lifecycles**: The parent scope waits for all child tasks to complete before returning.
- **Automatic Timeout Cancellation**: If the scope's deadline expires (`scope(deadline: Duration.ms(200))`), all child tasks and I/O operations are automatically cancelled.

### 3. Data-Race Freedom Without Rust's Curve
Rust provides unmatched memory safety via borrow checking and lifetimes, but imposes a steep learning curve that often slows down backend domain development.

FlexLang adopts **Mutability Isolation** (simplified Reference Capabilities):
- Any variable declared with `let` is **100% immutable** and can be safely shared across green threads.
- Variables declared with `let mut` belong strictly to the thread that created them. Sending a mutable value over a channel (`channel.send(data)`) **moves** ownership (*Move Semantics*). Accessing the variable after sending causes an **immediate compilation error**.

### 4. 100% Guaranteed Parity (Fast Dev & Solid Production)
FlexLang provides two frictionless execution modes:
- **`flex run` (Interpreted Mode)**: Ultra-fast local development feedback loop with instant `--watch` reloading.
- **`flex build` (Compiled Mode)**: Transpiles and compiles directly into a native binary via Go.

The **Type Checker** runs strictly before both paths, ensuring that valid local code executes with exact identical semantics in production.
