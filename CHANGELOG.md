# Changelog

Todas as mudanças notáveis do FlexLang são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/) — com a ressalva de que, enquanto `0.x`, `MINOR` pode conter breaking changes sem aviso prévio (ver [`.docs/v1/release_plan.md`](.docs/v1/release_plan.md), Seção 1).

## [Não lançado]

## [0.1.1] - 2026-08-15

Apenas documentação — sem mudança de comportamento. O `README.md` publicado no pacote npm estava desalinhado com a CLI real: faltavam os comandos `flex init`/`flex test`, o caminho de saída do `flex build` estava errado, a seção de testes documentava os scripts internos do compilador em vez do `flex test` do usuário, e o exemplo de `net/http` não mostrava logging estruturado, `on_shutdown` nem o health check automático (RFC-008). Corrigido e republicado para refletir a v0.1.0 real.

## [0.1.0] - 2026-08-14

Primeira versão pública do FlexLang. Implementa as RFCs 001–009 (ver [`.docs/v1/rfcs/`](.docs/v1/rfcs/)): paridade completa entre o modo interpretado e o transpiler Go, `Result`/`Option` nativos, módulos nativos (`net/http`, `db/postgres`), sistema de módulos locais, CLI (`flex init`/`run`/`build`/`test`), e a baseline de observabilidade e segurança para produção.

[Não lançado]: https://github.com/pedro2s/flexlang/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/pedro2s/flexlang/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pedro2s/flexlang/releases/tag/v0.1.0
