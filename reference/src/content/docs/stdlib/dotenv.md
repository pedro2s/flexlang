---
title: config/dotenv — Gerenciamento de Variáveis de Ambiente
description: Carregamento e parsing de arquivos .env para configuração segura de aplicações de backend.
---

O módulo `config/dotenv` carrega arquivos `.env` diretamente para o ambiente de execução (`os/env`), permitindo gerenciar segredos, portas e credenciais de banco de dados de maneira isolada por ambiente.

```flexlang
import { dotenv, DotenvConfig } from "config/dotenv";
import { env } from "os/env";
```

---

## 🚀 Uso Básico

```flexlang
// Carrega o arquivo .env padrão no diretório de execução
let res = dotenv.load();
match res {
    Result.Ok {
        print("Variáveis de ambiente carregadas com sucesso!");
    },
    Result.Err(e) {
        print("Aviso: arquivo .env não encontrado, usando variáveis do sistema");
    }
}

// Leitura das variáveis através do módulo os/env
let db_host = env.get_or("DB_HOST", "localhost");
let db_port = env.get_or("DB_PORT", "5432");
```

---

## ⚙️ Configuração Avançada

```flexlang
// Carregamento de arquivo específico
dotenv.load_file(".env.production");

// Carregamento com struct DotenvConfig
dotenv.load_with(DotenvConfig {
    path: ".env.staging",
    override: true, // Sobrescreve variáveis já existentes no processo
    debug: false
});

// Parsing direto de strings para Map
let parsed_map = dotenv.parse("API_KEY=flex_secret_9981\nMAX_RETRIES=3");
print(parsed_map);
```
