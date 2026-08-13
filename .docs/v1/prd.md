# PRD — FlexLang v1.0 ("Primeira Versão de Produção")

> **Status:** Draft · **Dono:** Arquitetura FlexLang · **Última revisão:** agosto/2026
> **Relacionado:** [`flexlang_architecture_roadmap.md`](../flexlang_architecture_roadmap.md) (o "porquê" arquitetural) · este PRD e as RFCs em [`rfcs/`](rfcs/) são o "o quê" e o "como" para chegar a uma versão que pode ir para produção.

## 1. Problema

A FlexLang hoje (Fases 0–2 concluídas, Fase 3 parcial — ver "Estado Atual" no roadmap) já é um compilador funcional: tem type checker, concorrência estruturada, traits e um transpiler Go rascunhado. Mas **não é possível, hoje, subir uma API real em produção com ela**, por um motivo muito concreto: o transpiler Go não sabe gerar código para `enum`, `match`, `?`, arrays ou booleanos — qualquer programa que use `Result` (que é como a linguagem trata erros) passa no type checker e quebra em `flex build`. Fora isso, faltam as peças óbvias de uma API real: banco de dados, múltiplos arquivos de projeto, logging, graceful shutdown.

Este documento define o que "pronto para produção" significa para a v1.0, e organiza o trabalho restante em RFCs endereçáveis e sequenciáveis.

## 2. Público-alvo e caso de uso principal

**Público-alvo da v1.0**: um time de backend que hoje escreveria essa API em Go, Node/TypeScript ou Kotlin, e quer avaliar a FlexLang como substituta em um serviço real, não em um brinquedo.

**Caso de uso de referência (o "hello world" de aceite da v1.0)**: uma API REST CRUD simples, com um recurso (`users`), persistindo em PostgreSQL, rodando atrás de um `flex build` compilado, aguentando reinício gracioso, com logs estruturados e testes automatizados. Se esse caso de uso não roda de ponta a ponta em produção, a v1.0 não está pronta — este é o critério de aceite mestre de todo o documento.

```flexlang
// Esboço do caso de uso de referência — o que a v1.0 precisa suportar de ponta a ponta
import { Server, Request, Response } from "net/http";
import { Pool } from "db/postgres";
import { find_by_id, insert } from "./repository/users"; // módulos locais — RFC-006

enum ApiError {
    NotFound(String),
    ValidationError(String),
    InternalError(String),
}

struct User {
    id: Int,
    name: String,
    email: String,
}

func get_user(req: Request, mut res: Response) {
    let id = req.param_int("id")?; // parâmetros de rota tipados — RFC-004
    match find_by_id(db, id) {
        Ok(user) => res.json(user),
        Err(e) => res.error(404, e),
    }
}

func main() -> Result<Void, ApiError> {
    let db = Pool.connect(env("DATABASE_URL"))?; // RFC-005
    let mut server = Server.new(":8080");
    server.route("/users/:id", get_user);
    server.on_shutdown(|| db.close()); // graceful shutdown — RFC-008
    server.start();
    return Ok(Void);
}
```

## 3. Objetivos de v1.0 (Definition of Done)

A v1.0 está pronta quando **todos** os itens abaixo forem verdadeiros. Cada um vira uma RFC dedicada.

| # | Objetivo | RFC | Prioridade |
|---|---|---|---|
| 1 | `flex build` gera Go correto para 100% da linguagem que o type checker aceita (`enum`, `match`, `?`, arrays, booleanos, lógicos, unários) | [RFC-001](rfcs/rfc-001-go-transpiler-parity.md) | **P0 — bloqueante** |
| 2 | `Result<T, E>` / `Option<T>` são tipos genéricos reais da stdlib, não convenção de nome de variante | [RFC-002](rfcs/rfc-002-result-option-stdlib.md) | **P0 — bloqueante** |
| 3 | Existe uma costura interna (`NativeModule`) para módulos nativos, para que o 2º módulo (Postgres) não repita o hack de string-matching do `net/http` | [RFC-003](rfcs/rfc-003-native-module-architecture.md) | P1 |
| 4 | `net/http` cobre o necessário para uma API real: path params, query params, corpo JSON tipado, respostas de erro estruturadas, timeouts, graceful shutdown | [RFC-004](rfcs/rfc-004-http-stdlib-v1.md) | **P0 — bloqueante** |
| 5 | Existe um driver nativo de PostgreSQL (`db/postgres`) com query parametrizada, pool de conexões e transações | [RFC-005](rfcs/rfc-005-postgres-native-module.md) | **P0 — bloqueante** |
| 6 | Um projeto FlexLang pode ser dividido em múltiplos arquivos locais (`import { X } from "./caminho"`) | [RFC-006](rfcs/rfc-006-local-module-system.md) | **P0 — bloqueante** |
| 7 | A CLI tem `flex init`, `flex test`, `flex build` robusto, e opcionalmente `flex fmt` | [RFC-007](rfcs/rfc-007-cli-toolchain-v1.md) | P0 (exceto `fmt`, que é P1) |
| 8 | Logging estruturado, recuperação de panic por request, graceful shutdown, health check | [RFC-008](rfcs/rfc-008-observability-and-ops-readiness.md) | **P0 — bloqueante** |
| 9 | Baseline de segurança: limites de tamanho de corpo, timeouts, apenas queries parametrizadas, ausência de segredos em logs | [RFC-009](rfcs/rfc-009-security-baseline.md) | **P0 — bloqueante** |
| 10 | Suíte de testes cobre paridade Node↔Go (o "parity gate") e testes de integração HTTP | [`test_plan.md`](test_plan.md) | **P0 — bloqueante** |

"P0 — bloqueante" significa: sem isso, o caso de uso de referência (Seção 2) não roda em produção. "P1" significa: valioso, mas a v1.0 pode sair sem, com um plano explícito de fast-follow.

## 4. Fora de escopo para v1.0 (explicitamente adiado)

Para não repetir o erro de superdimensionar o roadmap (feedback já registrado nas revisões anteriores), ficam **fora** da v1.0, com justificativa:

- **Gerenciador de pacotes remoto (`flex mod` completo, Seção 8 Estágio B do roadmap)** — o caso de uso de referência não exige dependências de terceiros, só múltiplos arquivos locais (RFC-006, Estágio A). Publicar/consumir pacotes da comunidade é v1.1+.
- **Arquitetura de plugins de terceiros para módulos nativos** — RFC-003 entrega só o suficiente para o próprio time não repetir hacks (2 módulos: HTTP e Postgres); carregar módulo compilado por terceiros é uma superfície de ataque que só se justifica quando existir ecossistema de fato.
- **WebSockets** — reaproveita a mesma fundação de I/O non-blocking, mas não é necessário para uma API REST CRUD. Fast-follow natural logo após a v1.0, sem nova arquitetura.
- **Decorators, Reflection/IoC em tempo de compilação, ORM/Query Builder, Row-Level Security/multi-tenancy, framework web oficial, runtime nativo via LLVM** — visão de longo prazo (Fase 6+ do roadmap arquitetural); nenhum é pré-requisito para "subir uma API em produção" com queries manuais e injeção de dependência explícita (passar `db: Pool` como parâmetro).
- **`flex fmt`** — desejável (ver RFC-007) mas não bloqueante: a ausência de formatador não impede deploy em produção.

## 5. Requisitos não-funcionais

- **Correção antes de performance.** Nenhuma otimização de performance é aceita antes do parity gate (Objetivo 1) estar verde — código Go incorreto rápido não serve.
- **Sem crash em cascata.** Uma exceção não tratada em um handler HTTP não pode derrubar o processo inteiro (RFC-008) — é o requisito não-funcional mais citado por times avaliando uma linguagem nova para produção.
- **Builds reprodutíveis.** `flex build` do mesmo `.flex` produz o mesmo binário Go-fonte, byte a byte, dado o mesmo compilador FlexLang (pré-requisito de qualquer CI/CD).
- **Sem segredos em texto claro nos artefatos de log ou erro** (RFC-009).
- **Tempo de build seco.** `flex build` de um projeto de referência (Seção 2) deve completar em segundos, não minutos — a v1.0 não pode introduzir uma etapa de build custosa sem necessidade real.

## 6. Métricas de sucesso da v1.0

1. O caso de uso de referência (Seção 2) roda 24h em ambiente de staging sem reinício não-planejado, sem vazamento de memória perceptível, e sem log de erro não tratado.
2. 100% dos testes da suíte golden-file (`tests/`) e dos novos testes de paridade Node↔Go (`test_plan.md`) passam em CI antes de qualquer release.
3. Zero itens "P0 — bloqueante" da tabela da Seção 3 em aberto.

## 7. Cronograma e dependências entre RFCs

Ordem de execução recomendada (dependências reais, não arbitrárias):

```
RFC-001 (parity Go)  ──┐
RFC-002 (Result/Option)─┼─► RFC-003 (Native Module) ─┬─► RFC-004 (HTTP v1)
                        │                              └─► RFC-005 (Postgres)
RFC-006 (módulos locais) ─────────────────────────────────────┘
RFC-007 (CLI) ── pode andar em paralelo, depende só de RFC-001/002 para `flex test` cobrir tudo
RFC-008 (observabilidade) ── depende de RFC-004 (precisa de hooks no Server)
RFC-009 (segurança) ── depende de RFC-004 e RFC-005 (superfícies a proteger)
```

RFC-001 e RFC-002 são o caminho crítico: nada mais deveria começar antes delas fecharem, porque qualquer coisa construída sobre um transpiler quebrado (ex: um driver Postgres) herdaria o mesmo risco de "passa no checker, quebra no build".

## 8. Riscos

- **Risco maior**: RFC-001 (parity Go) é subestimada em esforço — cobre 7 tipos de nó de AST que hoje nem sequer têm stub de tradução. Mitigação: o `test_plan.md` propõe um "parity gate" automatizado que roda todo `.flex` de teste tanto interpretado quanto compilado, comparando saída — isso torna a lacuna visível e mensurável desde o primeiro commit da RFC.
- **Risco de escopo**: a tentação de adicionar ORM/RLS/decorators "já que estamos mexendo no driver de banco". Mitigação: Seção 4 lista essas exclusões explicitamente; qualquer PR que as reintroduza deve linkar de volta a este PRD e justificar a mudança de escopo.
