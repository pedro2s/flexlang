# FlexLang v1.0 — Documentação de Ciclo de Desenvolvimento

Este diretório é o conjunto de especificações técnicas para levar a FlexLang da Fase 3 parcial (ver [`flexlang_architecture_roadmap.md`](../flexlang_architecture_roadmap.md)) até uma **primeira versão de produção**: capaz de sustentar uma API REST moderna, com banco de dados, rodando em produção de verdade.

- **[`prd.md`](prd.md)** — Product Requirements Document. Comece por aqui: define o caso de uso de referência, o que é "pronto para produção" (Definition of Done), o que fica deliberadamente fora de escopo, e a ordem de dependência entre as RFCs.
- **[`rfcs/`](rfcs/)** — uma RFC por área técnica, cada uma com motivação, design detalhado, plano de testes e critério de aceite.
- **[`test_plan.md`](test_plan.md)** — estratégia de testes compartilhada, incluindo o "parity gate" (Node↔Go), o mecanismo mais importante para garantir que `flex build` nunca gere Go quebrado silenciosamente.
- **[`release_plan.md`](release_plan.md)** — versionamento, checklist de release e o que define "v1.0.0 GA".

## Índice de RFCs (ordem de dependência, não de leitura)

| RFC | Título | Prioridade | Depende de |
|---|---|---|---|
| [001](rfcs/rfc-001-go-transpiler-parity.md) | Paridade Node↔Go no Transpiler | P0 | — (começa primeiro) |
| [002](rfcs/rfc-002-result-option-stdlib.md) | `Result`/`Option` como stdlib real | P0 | — (paralelo à 001) |
| [003](rfcs/rfc-003-native-module-architecture.md) | Arquitetura mínima de módulos nativos | P1 | 001, 002 |
| [004](rfcs/rfc-004-http-stdlib-v1.md) | `net/http` v1 — superfície de produção | P0 | 002, 003 |
| [005](rfcs/rfc-005-postgres-native-module.md) | Módulo nativo `db/postgres` | P0 | 002, 003 |
| [006](rfcs/rfc-006-local-module-system.md) | Sistema de módulos locais (multi-arquivo) | P0 | — (paralelo à 001/002) |
| [007](rfcs/rfc-007-cli-toolchain-v1.md) | CLI toolchain v1 (`init`, `test`, `fmt`) | P0 (exceto `fmt`, P1) | 001, 002, 006 |
| [008](rfcs/rfc-008-observability-and-ops-readiness.md) | Observabilidade e prontidão operacional | P0 | 004 |
| [009](rfcs/rfc-009-security-baseline.md) | Baseline de segurança | P0 | 004, 005 |

## Como usar este conjunto de documentos

1. Toda RFC começa como `Draft`. Ao ser implementada e validada pelo critério de aceite, atualize o cabeçalho de status para `Implementado` — este conjunto de arquivos é vivo, não uma fotografia de planejamento que se descola do código depois de escrito.
2. Se uma decisão desta pasta mudar durante a implementação (uma alternativa descartada acaba sendo necessária, um critério de aceite se mostra impraticável), edite a RFC correspondente e registre o motivo — não crie uma segunda fonte de verdade em outro lugar.
3. O que está fora de escopo (PRD, Seção 4) é uma decisão, não um esquecimento — qualquer PR que reintroduza algo dessa lista deve linkar de volta ao `prd.md` e justificar a mudança de escopo.
