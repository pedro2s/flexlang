# RFC-032 — Módulo de Carregamento de Configurações `.env` (`config/dotenv`)

> **Status:** Proposto · **Prioridade:** P0 — Bloqueante (Solicitado) · **Depende de:** RFC-026 (`os/env`), RFC-034 (`std/fs`)

---

## 1. Motivação e Requisitos

Em ambientes enterprise e arquiteturas modernas de backend (12-Factor App), as aplicações separam estritamente a base de código da configuração do ambiente. 

No ecossistema Node.js, a biblioteca `dotenv` é o padrão da indústria. No Go, bibliotecas como `godotenv` cumprem essa função. A FlexLang necessita de um **módulo nativo oficial (`config/dotenv`)** para carregar variáveis de arquivos `.env` diretamente no ambiente do processo, sem depender de scripts externos de shell antes de `flex run` ou `flex build`.

### 1.1 Recursos Obrigatórios do Parser `.env`
1. **Comentários**: Linhas iniciadas com `#` ou espaços seguidos de `#` são ignoradas.
2. **Aspas Simples e Duplas**: Suporte a valores entre `"..."` e `'...'`, preservando espaços e quebras de linha.
3. **Caracteres de Escape**: Suporte a `\n`, `\t`, `\"`, `\\` dentro de aspas duplas.
4. **Interpolação de Variáveis**: Expansão de variáveis existentes no formato `${VAR_NAME}` ou `$VAR_NAME` (ex: `DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}`).
5. **Comportamento de Precedência Configurável**:
   - **Modo Padrão (Sem sobrescrever)**: Variáveis já definidas no SO têm precedência sobre o arquivo `.env`.
   - **Modo Override (Sobrescrever)**: Variáveis do arquivo `.env` substituem variáveis do SO.
6. **Múltiplos Arquivos**: Carregamento em cascata (ex: `.env`, `.env.local`, `.env.test`, `.env.production`).

---

## 2. Design da API

```flexlang
import { dotenv, DotenvConfig } from "config/dotenv";
import { env } from "os/env";

// 1. Carregamento padrão (busca .env no diretório de trabalho atual)
dotenv.load();

// 2. Carregamento customizado com opções
dotenv.load_with(DotenvConfig {
    path: ".env.production",
    override: true,         // Sobrescreve variáveis já existentes no ambiente
    debug: false            // Não emite logs verbose de variáveis carregadas
});

// 3. Carregamento em cascata com fallback seguro
let result = dotenv.load_file(".env.local");
if result.is_err() {
    dotenv.load_file(".env")?;
}

// 4. Parsing em memória a partir de String (sem tocar no disco)
let custom_vars = dotenv.parse("PORT=8080\nDB_HOST=localhost\n# comentario");
```

---

## 3. Exemplo de Arquivo `.env` e Interpolação

```ini
# ==============================================================================
# Configurações do Core Bancário FlexBank
# ==============================================================================
ENVIRONMENT="production"
PORT=8080
DEBUG=false

# Banco de Dados Postgres Principal
DB_USER=flexadmin
DB_PASS="p@ss#w0rd!2026"
DB_HOST=10.0.0.15
DB_PORT=5432
DB_NAME=flexbank_production

# Interpolação de Variáveis
DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"

# Integração BACEN Pix
BACEN_SPI_URL="https://spi.bacen.gov.br/api/v2"
BACEN_TIMEOUT_SECONDS=5
BACEN_MTLS_CERT_PATH="/etc/ssl/certs/pix_client.crt"
BACEN_MTLS_KEY_PATH="/etc/ssl/private/pix_client.key"
```

---

## 4. Integração no Bootstrap do `main.flex`

```flexlang
import { dotenv } from "config/dotenv";
import { env } from "os/env";
import { Server, ServerConfig } from "net/http";
import { log } from "core/log";

func main() {
    // Carrega o .env antes de inicializar o servidor
    dotenv.load();

    let port = env.get_or("PORT", "3000");
    let db_url = env.require("DATABASE_URL");
    let environment = env.get_or("ENVIRONMENT", "development");

    log.info("Inicializando FlexBank Core", {
        env: environment,
        port: port
    });

    let mut server = Server.new(":${port}", ServerConfig {
        read_timeout: 5000,
        max_body_size: 2000000
    });

    server.get("/healthz", |req, mut res| {
        res.status(200).json({ status: "healthy", env: environment });
    });

    server.listen();
}
```

---

## 5. Implementação e Paridade

### 5.1 Modo Interpretado (TypeScript)
- Implementa um parser de tokens linha a linha compatível com a especificação `dotenv` e `dotenv-expand`.
- Injeta as variáveis diretamente em `process.env` respeitando a flag `override`.

### 5.2 Modo Compilado (Go Nativo)
- O transpiler Go embute o parser `.env` ou injeta o pacote padrão `github.com/joho/godotenv`.
- As variáveis são injetadas no ambiente do SO via `os.Setenv(key, val)`.

---

## 6. Plano de Testes

- Teste de comentários, espaços em branco e linhas vazias.
- Teste de aspas simples, duplas e quebras de linha com escape `\n`.
- Teste de interpolação recursiva `${A}/${B}`.
- Teste de precedência `override: false` vs `override: true`.
- Teste de carregamento de arquivo ausente retornando `Result.Err("FILE_NOT_FOUND")`.
- Paridade 100% no parity gate.
