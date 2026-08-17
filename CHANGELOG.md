# Changelog

Todas as mudanças notáveis do FlexLang são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/) — com a ressalva de que, enquanto `0.x`, `MINOR` pode conter breaking changes sem aviso prévio (ver [`.docs/v1/release_plan.md`](.docs/v1/release_plan.md), Seção 1).

## [Não lançado]

## [0.2.0] - 2026-08-17

Segunda release pública da FlexLang. Torna a linguagem capaz de expressar APIs REST completas e elimina divergências aritméticas e de roteamento entre o interpretador e a compilação Go. Implementa as RFCs 011 a 016 (ver [`.docs/v0.2/rfcs/`](.docs/v0.2/rfcs/)).

### Adicionado
- **Roteamento por Verbo HTTP (RFC-011)**: Adicionados métodos dedicados `server.get`, `server.post`, `server.put`, `server.patch` e `server.delete` no módulo `net/http`.
- **Semântica 405 e Despacho em Duas Fases (RFC-011)**: Retorna `405 Method Not Allowed` com cabeçalho `Allow: ...` listando os métodos suportados quando a rota existe com outros verbos.
- **Derivação Automática de HEAD e OPTIONS (RFC-011)**: Requisições `HEAD` executam o handler de `GET` omitindo o corpo, e `OPTIONS` responde com `204 No Content` e o cabeçalho `Allow`.
- **Cadeia Global de Middlewares (RFC-015)**: Suporte a middlewares via `server.use(...)` compartilhando a assinatura `func(Request, mut Response)`. Interrupção automática caso o middleware emita resposta, e isenção incondicional da rota `GET /healthz`.
- **Headers HTTP (RFC-015)**: Leitura case-insensitive em `req.header(name: String) -> Option<String>` e emissão encadeável de cabeçalhos de resposta em `res.header(name: String, value: String) -> Response`.
- **CORS Nativo (RFC-015)**: Configuração de CORS com `server.cors(CorsConfig { ... })` cobrindo requisições simples e preflight `OPTIONS` com `Access-Control-Allow-*` e `Vary: Origin`.
- **Modo Watch e Resolução de Projeto (RFC-012)**: Execução em hot reload com `flex run --watch` / `-w` e resolução automática do entrypoint através do campo `entry` no `flex.toml`.
- **Tipo Primitivo Float e Paridade Aritmética (RFC-013)**: Adicionado tipo `Float` (IEEE 754 de 64 bits), métodos de conversão `to_float()` e `to_int()`, promoção segura de literais untyped e garantia de paridade aritmética estrita (ex: `7.0 / 2.0` resulta em `3.5` em ambos os modos).
- **Diagnósticos Ricos do Compilador (RFC-014)**: Mensagens de erro estilo Rustc com arquivo, linha, coluna, ponteiros visuais `^^^^`, cores ANSI e sugestões `help:`, sem vazamento de stack traces do Node.js.
- **Versionamento no Manifesto (RFC-016)**: Checagem de compatibilidade da versão do compilador através do campo `flex_version = "0.2.0"` no `flex.toml`.
- **Projeto de Exemplo Completo**: Adicionado `examples/08_le_salvi_api` demonstrando 100% dos recursos da v0.2.0 em uma API REST modular em camadas.

### Modificado
- **Unificação Sintática de Blocos (RFC-016)**: Removido o operador `=>` dos braços de `match`, padronizando a sintaxe de blocos em toda a linguagem. Adicionado diagnóstico amigável `E1002` em caso de uso da sintaxe legada.

### Removido
- **Breaking Change (RFC-011)**: Removido o método `server.route(path, handler)`. Tentativas de uso emitem o diagnóstico `E2024` sugerindo a migração para os métodos por verbo.

## [0.1.1] - 2026-08-15

Apenas documentação — sem mudança de comportamento. O `README.md` publicado no pacote npm estava desalinhado com a CLI real: faltavam os comandos `flex init`/`flex test`, o caminho de saída do `flex build` estava errado, a seção de testes documentava os scripts internos do compilador em vez do `flex test` do usuário, e o exemplo de `net/http` não mostrava logging estruturado, `on_shutdown` nem o health check automático (RFC-008). Corrigido e republicado para refletir a v0.1.0 real.

## [0.1.0] - 2026-08-14

Primeira versão pública do FlexLang. Implementa as RFCs 001–009 (ver [`.docs/v1/rfcs/`](.docs/v1/rfcs/)): paridade completa entre o modo interpretado e o transpiler Go, `Result`/`Option` nativos, módulos nativos (`net/http`, `db/postgres`), sistema de módulos locais, CLI (`flex init`/`run`/`build`/`test`), e a baseline de observabilidade e segurança para produção.

[Não lançado]: https://github.com/pedro2s/flexlang/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pedro2s/flexlang/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pedro2s/flexlang/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pedro2s/flexlang/releases/tag/v0.1.0
