---
title: config/dotenv — Environment Configuration
description: Loading and parsing .env files for secure configuration of backend applications.
---

The `config/dotenv` module loads `.env` files into process environment variables (`os/env`), allowing isolated credential and configuration management across development, staging, and production.

```flexlang
import { dotenv, DotenvConfig } from "config/dotenv";
import { env } from "os/env";
```

---

## 🚀 Quickstart

```flexlang
// Loads default .env file in the current directory
let res = dotenv.load();
match res {
    Result.Ok {
        print("Environment variables loaded successfully!");
    },
    Result.Err(e) {
        print("Notice: .env file not found, using system environment");
    }
}

// Access environment variables
let db_host = env.get_or("DB_HOST", "localhost");
let db_port = env.get_or("DB_PORT", "5432");
```

---

## ⚙️ Advanced Configuration

```flexlang
// Load specific path
dotenv.load_file(".env.production");

// Custom configuration with DotenvConfig
dotenv.load_with(DotenvConfig {
    path: ".env.staging",
    override: true,
    debug: false
});

// Direct in-memory string parsing
let config_map = dotenv.parse("API_KEY=flex_secret_9981\nMAX_RETRIES=3");
```
