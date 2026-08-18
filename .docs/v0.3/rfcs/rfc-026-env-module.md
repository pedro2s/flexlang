# RFC-026 — Módulo `os/env` — Variáveis de Ambiente

> **Status:** Proposto · **Prioridade:** P0 — bloqueante · **Depende de:** nada

## 1. Motivação

Credenciais de banco, URLs de serviços externos, feature flags e configuração por ambiente (dev/staging/prod) são injetadas via variáveis de ambiente em qualquer backend moderno. Atualmente, valores sensíveis precisam ser hardcoded no código FlexLang.

## 2. API

```flexlang
import { env } from "os/env";

// Leitura de variável de ambiente
let db_url = env.get("DATABASE_URL");            // Option<String>
let port = env.get_or("PORT", "3000");            // String (com default)
let secret = env.require("JWT_SECRET");           // String (panic se ausente)

// Verificação de existência
let has_debug = env.has("DEBUG");                  // Bool
```

### 2.1 Métodos

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `get` | `env.get(name: String)` | `Option<String>` | Lê a variável, retorna `None` se ausente |
| `get_or` | `env.get_or(name: String, default: String)` | `String` | Lê com fallback |
| `require` | `env.require(name: String)` | `String` | Lê ou panic com mensagem clara |
| `has` | `env.has(name: String)` | `Bool` | Verifica se a variável existe |

## 3. Implementação

### 3.1 Interpretador (TS)
- `env.get(name)` → `process.env[name]` → wrap em `Option`
- `env.require(name)` → `process.env[name]` → throw se undefined

### 3.2 Transpiler Go
- `env.get(name)` → `os.LookupEnv(name)` → wrap em `Option`
- `env.require(name)` → `os.Getenv(name)` com `panic` se vazio
- Adiciona `import "os"` ao boilerplate

## 4. Exemplo de Uso

```flexlang
import { env } from "os/env";
import { Server, ServerConfig } from "net/http";

let port = env.get_or("PORT", "3000");
let db_url = env.require("DATABASE_URL");

let mut server = Server.new(":${port}", ServerConfig {
    read_timeout: 5000,
    max_body_size: 2000000
});
```

## 5. Plano de Testes

- Golden test: `env.get` com variável existente → `Option.Some`
- Golden test: `env.get` com variável ausente → `Option.None`
- Golden test: `env.get_or` com fallback
- Golden test: `env.has` → `true` / `false`
- Parity test: paridade completa
