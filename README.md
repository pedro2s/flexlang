<div align="center">
  <img src="https://raw.githubusercontent.com/pedro2s/flexlang/main/assets/octans-logo.svg" alt="FlexLang" width="120" height="120" />

  <h1>FlexLang</h1>
  <p><strong>A linguagem definitiva para Backends Escaláveis, Seguros e Altamente Performáticos.</strong></p>
  <p>
    <i>Sintaxe limpa. Semântica rigorosa. Zero Data Races. Compilação nativa Go.</i>
  </p>
  <p>
    <img src="https://img.shields.io/npm/v/%40flexlang%2Fcli?style=flat-square&label=npm&color=blue" alt="npm version" />
    <img src="https://img.shields.io/github/actions/workflow/status/pedro2s/flexlang/ci.yml?branch=main&style=flat-square&label=tests" alt="Tests" />
    <img src="https://img.shields.io/badge/target-Go%20%7C%20Node.js-informational?style=flat-square" alt="Targets" />
    <img src="https://img.shields.io/badge/license-ISC-green?style=flat-square" alt="License" />
  </p>
</div>

---

A **FlexLang** nasceu da necessidade de unir a simplicidade no aprendizado e produtividade (com sintaxe clara e familiar) à segurança extrema de acesso à memória e alto desempenho para sistemas paralelos que processam pesadas cargas de I/O em Backend.

Esqueça o *Callback Hell* ou funções "coloridas" (`async/await`). Na FlexLang, a concorrência estruturada flui nativamente inspirada no ecossistema Go, sendo suportada por transpiladores modernos que vertem seu código seguro diretamente para binários Go nativos de alta disponibilidade.

---

## ✨ Destaques & Filosofia

- **🔒 Imutabilidade por Padrão:** Variáveis na FlexLang são imutáveis por padrão (`let`). A mutabilidade (`let mut`) é explícita e rastreada pelo compilador.
- **⚡ Concorrência Estruturada Nativa:** Crie rotinas secundárias usando o bloco `scope` / `spawn`. O compilador gerencia o ciclo de vida das tarefas e sincroniza execuções concorrentes de forma limpa.
- **🛡️ Erradicação de Data Races:** Canais (`Channel.new()`) são o meio primordial de comunicação de estado em concorrência. Quando uma variável mutável é repassada via canal (`send`), nosso compilador ativa as regras de *Move Semantics*: a posse da variável na origem é revogada estaticamente (*Use-after-send* é barrado em tempo de compilação).
- **🎯 Tratamento Funcional de Erros:** Nada de `null`, `nil` ou exceções descontroladas. Tipos `Result<T, E>` e `Option<T>` embutidos como cidadãos de primeira classe, com propagação elegante via operador `?` e desestruturação exaustiva via `match`.
- **🌐 Stdlib Produtiva para Backend:** Módulos nativos de alto desempenho integrados, incluindo `net/http` (com path params, parsing de JSON e timeout) e `db/postgres` (com pool de conexões gerenciado, queries parametrizadas obrigatórias `$1` e transações atômicas ACID com rollback automático).
- **📦 Sistema de Módulos Locais:** Importações limpas entre múltiplos arquivos (`import { X } from "./models/user"`), resolução automática de dependências, detecção de ciclos de import e compilação Go unificada em arquivo único.
- **⚙️ CLI Unificada (`flex`):** Um comando para todas as etapas. De `flex run` (desenvolvimento ágil interpretado) a `flex build` (transpilação Go e compilação para binário nativo).

---

## 🚀 Guia de Início Rápido

### Instalação

```bash
npm install -g @flexlang/cli
```

Ou use via `npx`, sem instalar nada globalmente:

```bash
npx @flexlang/cli run caminho/para/arquivo.flex
```

### Comandos da CLI (`flex`)

```bash
# 1. Criar um novo projeto (gera flex.toml, src/main.flex e um teste de exemplo já passando)
flex init meu-projeto
cd meu-projeto

# 2. Executar no modo interpretado (desenvolvimento ágil; resolve imports locais automaticamente)
flex run src/main.flex

# 3. Rodar os testes do projeto (busca *_test.flex recursivamente; gera o .out na primeira vez)
flex test

# 4. Compilar para binário nativo via Go (saída em ./build/<nome>.go e ./build/<nome>)
flex build src/main.flex
./build/main
```

> `flex init` grava um `flex.toml` com nome, versão e o caminho de entrada (`entry`) do projeto — hoje isso é só metadado: nenhum comando (`run`/`test`/`build`) lê esse campo ainda, então o caminho do arquivo precisa ser sempre informado explicitamente.

### Contribuindo (build a partir do código-fonte)

```bash
git clone https://github.com/pedro2s/flexlang.git
cd flexlang
npm install
npm run build          # gera dist/cli.js
node dist/cli.js run caminho/para/arquivo.flex
```

A suíte que valida o **compilador em si** — diferente do `flex test` acima, que valida o *seu* projeto — roda via scripts deste repositório:

```bash
npm test              # suíte golden-file interna (tests/)
npm run test:parity   # paridade Node (interpretado) vs. Go (compilado) — RFC-001
npm run test:http     # integração HTTP real
npm run test:db       # integração PostgreSQL real
```

---

## 💻 Tour pela Linguagem & Exemplos

### 1. Servidor Web Moderno (`net/http`)

Suba uma API REST robusta com suporte nativo a rotas dinâmicas, parsing tipado de JSON e códigos de status HTTP:

```flexlang
import { Server, Request, Response } from "net/http";
import { log } from "core/log";

struct CreateUserDTO {
    name: String,
    role: String
}

func handle_create_user(req: Request, mut res: Response) {
    match req.json() {
        Result.Ok(dto) => {
            log.info("user created", { name: dto.name, role: dto.role });
            res.status(201).json(dto);
        },
        Result.Err(msg) => {
            log.error("invalid payload", { reason: msg });
            res.error(400, "Corpo JSON invalido");
        }
    }
}

let mut server = Server.new(":8080");
server.route("/users", handle_create_user);

// Roda antes do processo encerrar (SIGINT/SIGTERM tratados automaticamente)
server.on_shutdown(|| {
    log.info("server shutting down", { status: "graceful" });
});

print("🚀 Servidor online em http://localhost:8080");
server.start();
```

- **`GET /healthz`** já vem registrado por padrão, sem nenhum código adicional — pronto para o health check de qualquer orquestrador (Kubernetes, systemd).
- Um panic dentro de um handler (ex: acesso a índice fora do array) é **recuperado por request** — derruba só aquela resposta com `500`, nunca o processo inteiro.
- `log.info`/`log.error` emitem uma linha JSON estruturada por evento, com **mascaramento automático** de campos sensíveis (`password`, `token`, `secret`, `authorization`, `api_key`).

---

### 2. Persistência Nativa com PostgreSQL (`db/postgres`)

Conexões gerenciadas por pool, proteção contra SQL Injection com parâmetros posicionais `$1` e transações ACID via lambdas com rollback automático:

```flexlang
import { Pool, Tx } from "db/postgres";

match Pool.connect("postgres://postgres:postgres@localhost:5432/postgres") {
    Result.Ok(pool) => {
        // Query com parâmetro obrigatório $1
        let rows = pool.query("SELECT id, name, balance FROM accounts WHERE balance >= $1", [500])?;
        
        // Transação atômica ACID
        pool.transaction(|tx: Tx| {
            tx.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [100, 1]);
            tx.execute("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [100, 2]);
        })?;

        pool.close();
    },
    Result.Err(err) => {
        print("Falha ao conectar no banco: ${err}");
    }
}
```

---

### 3. Concorrência Estruturada, Canais & *Move Semantics*

O compilador garante a ausência de *Data Races* bloqueando o acesso a dados mutáveis após o envio por canal:

```flexlang
struct TaskPayload {
    id: Int,
    content: String
}

func main() {
    let mut c = Channel.new();
    
    scope {
        spawn {
            let mut payload = TaskPayload { id: 1, content: "Processamento seguro" };
            c.send(payload); // 'payload' é MOVIDO. Tentar acessá-lo aqui dispararia Use-after-send no compilador!
        }
        
        let received = c.recv();
        print("Recebido da Green Thread: ${received.content}");
    }
}

main();
```

---

### 4. Tratamento Funcional de Erros (`Result` e `Option`)

Erros e ausência de dados são modelados explicitamente através de tipos genéricos e propagação com `?`:

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
        Option.Some(u) => Result.Ok(u.name),
        Option.None => Result.Err("Usuario nao encontrado")
    }
}
```

---

### 5. Arquitetura Modular Multi-arquivo

Organize projetos reais em múltiplas camadas limpas:

```flexlang
// arquivo: services/order_service.flex
import { Order } from "../models/order";
import { find_order_by_id } from "../repository/order_repository";

func process_order(id: Int) -> Result<String, String> {
    let order = find_order_by_id(id)?;
    return Result.Ok("Pedido #${order.id} processado com sucesso!");
}
```

---

## 📚 Catálogo de Exemplos Executáveis

O diretório [**`examples/`**](./examples/) contém exemplos práticos prontos para execução e compilação:

| Exemplo | Descrição | Destaques |
| :--- | :--- | :--- |
| [**`01_hello_http.flex`**](./examples/01_hello_http.flex) | Hello World de Servidor Web | Inicialização do `net/http` e resposta JSON básica |
| [**`02_concurrency.flex`**](./examples/02_concurrency.flex) | Concorrência Estruturada | `scope`, `spawn`, `Channel` e *Move Semantics* |
| [**`03_traits.flex`**](./examples/03_traits.flex) | Polimorfismo e Traits | Interfaces estritas e validação estática de implementação |
| [**`04_result_and_option.flex`**](./examples/04_result_and_option.flex) | Tratamento Funcional de Erros | `Result<T, E>`, `Option<T>`, operador `?` e pattern matching |
| [**`05_rest_api_http.flex`**](./examples/05_rest_api_http.flex) | API REST Completa | Path params (`:id`), query params, status codes e JSON DTOs |
| [**`06_database_postgres.flex`**](./examples/06_database_postgres.flex) | Banco de Dados PostgreSQL | Pool de conexões, queries `$1, $2` e transações atômicas ACID |
| [**`07_multi_file_architecture/`**](./examples/07_multi_file_architecture/) | Arquitetura Multi-arquivo | Camadas `models/`, `repository/`, `services/` e ponto de entrada `main.flex` |

---

## 🧪 Testando seu Projeto FlexLang

Todo projeto criado com `flex init` já nasce com um teste rodando (`tests/health_test.flex` + `tests/health_test.out`). O `flex test` segue a convenção **golden-file**: qualquer arquivo `*_test.flex` é executado e sua saída é comparada com um `.out` de mesmo nome.

```bash
flex test                          # roda todo *_test.flex a partir do diretório atual
flex test tests/                   # limita a busca a um diretório
flex test tests/health_test.flex   # roda um arquivo específico
```

- Se o `.out` correspondente ainda não existir, `flex test` **gera ele automaticamente** na primeira execução (marcado como `[GENERATED]`) — a saída vira a expectativa a partir dali.
- O comando sai com código de erro (`exit 1`) se qualquer teste falhar — pronto para usar como gate de CI no seu próprio projeto.

---

## 🏛️ Arquitetura e Engenharia Interna

- 📖 **[Roadmap Arquitetural (ADR-001)](./.docs/flexlang_architecture_roadmap.md)** — Visão holística da evolução do compilador e especificação técnica.
- 📖 **[RFC-001: Go Transpiler Parity](./.docs/v1/rfcs/rfc-001-go-transpiler-parity.md)** — Paridade total entre runtime interpretado e binário compilado.
- 📖 **[RFC-002: Result e Option Stdlib](./.docs/v1/rfcs/rfc-002-result-option-stdlib.md)** — Tipos fundamentais e expansão do operador `?`.
- 📖 **[RFC-003: Arquitetura de Módulos Nativos](./.docs/v1/rfcs/rfc-003-native-module-architecture.md)** — Infraestrutura desacoplada para módulos stdlib.
- 📖 **[RFC-004: net/http v1](./.docs/v1/rfcs/rfc-004-http-stdlib-v1.md)** — Superfície de produção para servidores web.
- 📖 **[RFC-005: db/postgres](./.docs/v1/rfcs/rfc-005-postgres-native-module.md)** — Driver de banco de dados nativo com pool e transações.
- 📖 **[RFC-006: Local Module System](./.docs/v1/rfcs/rfc-006-local-module-system.md)** — Resolução e compilação de módulos locais multi-arquivo.
- 📖 **[RFC-007: CLI Toolchain v1](./.docs/v1/rfcs/rfc-007-cli-toolchain-v1.md)** — `flex init`, `flex test` e o hardening de `flex build`.
- 📖 **[RFC-008: Observabilidade e Prontidão Operacional](./.docs/v1/rfcs/rfc-008-observability-and-ops-readiness.md)** — Logs estruturados, graceful shutdown e health check.
- 📖 **[RFC-009: Baseline de Segurança](./.docs/v1/rfcs/rfc-009-security-baseline.md)** — Defaults seguros para produção.
- 📖 **[RFC-010: CI/CD e Publicação npm](./.docs/v1/rfcs/rfc-010-release-cicd-npm-publish.md)** — Pipeline de release, versionamento e codinomes.
- 📖 **[Plano de Release](./.docs/v1/release_plan.md)** — Versionamento, codinomes de astronomia e o processo de corte de release.

---

<div align="center">
  <img src="https://raw.githubusercontent.com/pedro2s/flexlang/main/assets/octans-mascot.jpeg" alt="Octans, o mascote da FlexLang" width="420" />
  <p><strong>Octans</strong> — o mascote da FlexLang, batizado em homenagem à constelação austral que também inspira o esquema de codinomes de versão.</p>
  <p><i>"Faça simples, faça robusto. Construa com FlexLang."</i></p>
</div>
