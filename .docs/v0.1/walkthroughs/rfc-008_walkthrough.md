# Implementação da RFC-007 e RFC-008

Este walkthrough resume as melhorias aplicadas na CLI da FlexLang (`src/cli.ts`) e as adições de práticabilidade operacional para oferecer uma experiência completa e robusta de desenvolvimento.

## 1. FlexLang CLI (RFC-007)
A CLI foi reescrita para fornecer as funcionalidades essenciais para uma linguagem compilada, suportando Hexagonal Architecture, roteamento de testes e build unificado.

### Comandos da CLI:
- **`flex init [dir]`**: Inicializa um projeto FlexLang, suportando a flag `--hex` para criar uma estrutura orientada a domínios (Hexagonal Architecture) com diretórios `src/domain`, `src/adapters`, `src/ports` e `tests/`.
- **`flex test [file]`**: Roda os testes do usuário, usando o modo *golden files*. Ele interpreta o código, coleta a saída para `stdout`, salva como `.out` e compara se a saída é idêntica na próxima execução.
- **`flex build [file]`**: Transpila o FlexLang para Go e roda o `go build`, isolando o resultado em um diretório de artefatos (ex: `build/`).
- **`flex run [file]`**: Executa o código em modo interpretado diretamente.

## 2. Observabilidade e Prontidão Operacional (RFC-008)
Transformamos o FlexLang em uma ferramenta pronta para produção, introduzindo suporte profundo a Map Literals (Opção C escolhida), sistema de log nativo e Hardening no servidor HTTP.

### Map Literals
Adicionado suporte completo à sintaxe de literais de mapas `let m = { chave: "valor" }` integrado à linguagem:
- **Parser & AST**: Reconhece a sintaxe JSON-like nativamente sem ambiguidade com Structs.
- **Checker**: Tipagem genérica adaptável (`Map`).
- **Transpiler & Interpreter**: Instanciado como um mapa `map[string]any` em Go e um objeto genérico `Map` interno no JS.

### Módulo de Logs (`core/log`)
Um módulo nativo de logging estruturado (JSON) focado em observabilidade de nuvem e ferramentas como Datadog/Grafana:
- `log.info("msg", { env: "prod" })`
- `log.error("msg", { code: 500 })`
Esses logs são ejetados com timestamps formatados (`RFC3339` no Go, `ISOString` no JS).

### Hardening do Servidor HTTP (`net/http`)
- **Panic Recovery Seguro**: Panics causados em rotas HTTP e *green threads* (`spawn`) não derrubam mais a aplicação. Emitem no log um erro estruturado de recuperação de pânico, garantindo isolamento total de threads defeituosas.
- **Endpoint `/healthz` Padrão**: Uma rota de liveness check pré-configurada para Kubernetes embutida invisivelmente no `Server.new`.
- **Graceful Shutdown**: Implementado método `on_shutdown(|| { ... })` para registrar callbacks de limpeza, escutando nativamente `SIGINT` e `SIGTERM` em Go e NodeJS para fechamento seguro do servidor.

## Validation Results
- Suíte completa de 31 testes unitários (`npm run test`) passando. Adicionado cobertura para literais de mapas, testes do módulo `core/log` e panics isolados em servidor HTTP.
- Todos os recursos avaliados comportam-se de forma isomórfica nos modos Intepretado (TypeScript) e Compilado (Go).
