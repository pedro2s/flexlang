---
title: os/env — Variáveis de Ambiente
description: Leitura segura, defaults e validação estrita de variáveis de ambiente.
---

O módulo `os/env` fornece acesso seguro a configurações de ambiente e credenciais injetadas em contêineres de produção.

```flexlang
import { env } from "os/env";
```

---

## 📋 Métodos

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `get` | `env.get(name: String)` | `Option<String>` | Lê a variável retornando `Some(valor)` ou `None` se não existir. |
| `get_or` | `env.get_or(name: String, default: String)` | `String` | Lê a variável ou retorna o valor padrão fornecido. |
| `require` | `env.require(name: String)` | `Result<String, String>` | Retorna `Ok(valor)` ou `Err` caso a variável obrigatória não esteja definida. |
| `has` | `env.has(name: String)` | `Bool` | Retorna `true` se a variável existir no ambiente. |

---

## 💡 Exemplo de Inicialização de Configuração

```flexlang
import { env } from "os/env";

struct AppConfig {
    port: String,
    database_url: String,
    debug_mode: Bool
}

func carregar_config() -> Result<AppConfig, String> {
    let port = env.get_or("PORT", "8080");
    let db_url = env.require("DATABASE_URL")?;
    let debug = env.has("DEBUG");

    return Result.Ok(AppConfig {
        port: port,
        database_url: db_url,
        debug_mode: debug
    });
}
```
