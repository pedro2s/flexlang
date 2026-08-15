# FlexLang v0.2.0 — Especificações

Conjunto de especificações da segunda release pública da FlexLang. A v0.1.x provou que a linguagem compila para Go e roda em produção; a v0.2.0 a torna capaz de expressar uma **API REST de verdade** e corrige três defeitos que só apareceram ao executar o compilador publicado.

- **[`prd.md`](prd.md)** — comece aqui: o diagnóstico do estado atual (com evidência de execução), o caso de uso de referência, escopo e o que ficou deliberadamente de fora.
- **[`rfcs/`](rfcs/)** — uma RFC por frente, com design, alternativas descartadas, plano de testes e critério de aceite.
- **[`test_plan.md`](test_plan.md)** — a matriz de divergência Node↔Go, principal entrega de teste desta release.

## RFCs

| RFC | Título | Prioridade | Origem |
|---|---|---|---|
| [011](rfcs/rfc-011-http-method-routing.md) | Roteamento por verbo HTTP (`get`/`post`/`put`/`patch`/`delete`, `405`) | **P0** | pedido explícito |
| [012](rfcs/rfc-012-flex-run-watch.md) | `flex run --watch` e `entry` do `flex.toml` | **P0** | pedido explícito |
| [013](rfcs/rfc-013-float-and-arithmetic-parity.md) | Tipo `Float` e correção da paridade aritmética | **P0** | achado desta análise |
| [014](rfcs/rfc-014-compiler-diagnostics.md) | Diagnósticos com linha/coluna, sem stack trace do Node | **P0** | achado desta análise |
| [015](rfcs/rfc-015-middleware-and-cors.md) | Middleware, headers e CORS | P1 | achado desta análise |

**Ordem de execução:** 013 e 014 primeiro (mexem em lexer/parser/AST/checker; todo o resto herda spans e tipos), depois 011 e 015 em sequência (tocam o mesmo `src/modules/http.ts`). A 012 é independente e pode andar a qualquer momento.

## Os três achados

O que motivou as RFCs 013, 014 e 015 não estava em nenhuma lista de pendências — apareceu ao executar o compilador publicado:

1. **`7 / 2` dá `3.5` interpretado e `3` compilado.** Viola a promessa central do ADR-001. O parity gate não pegou porque nenhum teste fazia divisão. Não existe tipo `Float`: `19.90` é tipado como `Int`.
2. **Erros do compilador não dizem onde**, e chegam ao usuário com o stack trace interno do Node. Os tokens carregam linha/coluna, mas o parser descarta essa informação ao construir a AST.
3. **O roteador ignora o verbo HTTP** — `GET /users` e `POST /users` são o mesmo handler, o que impossibilita CRUD.

## Convenção de versão

Esta pasta se chama `v0.2` pela versão que especifica. A anterior, [`.docs/v1/`](../v1/), corresponde à release **`0.1.0`** — o nome ficou de quando o alvo ainda era chamado "v1", antes da decisão de publicar em `0.x` (ver [`release_plan.md`](../v1/release_plan.md) §1). O processo de corte de release, o versionamento e o esquema de codinomes de astronomia continuam definidos lá.

Como a v0.2.0 continua na trilha `0.x`, **não recebe codinome** — codinomes começam em `1.0` ("Orion"). A remoção de `server.route` (RFC-011) é um breaking change permitido pela política de `0.x`.
