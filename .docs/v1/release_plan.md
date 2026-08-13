# Plano de Release — FlexLang v1.0

> **Status:** Draft · **Relacionado:** [`prd.md`](prd.md) (Definition of Done), [`test_plan.md`](test_plan.md) (gate de qualidade)

## 1. Versionamento

A FlexLang adota `MAJOR.MINOR.PATCH` a partir da v1.0. Antes da v1.0 (estado atual), a linguagem está em `0.x` — qualquer coisa pode quebrar entre commits, sem aviso, porque não há usuário externo dependendo dela ainda. **A partir de `1.0.0`, um breaking change de sintaxe ou de comportamento observável da stdlib exige um `MAJOR` novo.**

- `PATCH` (`1.0.x`): correção de bug, sem mudança de comportamento observável esperado (ex: fechar uma regressão do parity gate).
- `MINOR` (`1.x.0`): feature aditiva, compatível com código `1.0` existente (ex: WebSockets, `flex mod`).
- `MAJOR` (`x.0.0`): breaking change deliberado, documentado com guia de migração.

## 2. O que é "v1.0.0 GA" (General Availability)

v1.0.0 é a primeira tag que qualquer time pode usar em produção com confiança. É "GA", não "beta", quando:

1. Todos os itens P0 da tabela do PRD (Seção 3) estão fechados.
2. O gate de testes completo (`test_plan.md`, Seção 3) está verde.
3. O caso de uso de referência do PRD (Seção 2) rodou em staging por 24h sem incidente (métrica de sucesso do PRD, Seção 6).
4. A documentação pública (README + este conjunto de RFCs, mantido como changelog de decisões) está atualizada para refletir o comportamento real da v1.0 — nenhuma RFC "Draft" descrevendo algo que ainda não existe deve permanecer sem uma nota de status atualizada.

## 3. Canais de release (deliberadamente simples para v1.0)

Só dois canais — nada de nightly/canary/beta paralelos, que exigem infraestrutura de release desproporcional para o tamanho atual do projeto:

- **`main`**: sempre no estado mais recente testado (gate do `test_plan.md` verde em todo commit).
- **Tags `vX.Y.Z`**: pontos de release, criados manualmente após o checklist da Seção 4 abaixo.

## 4. Checklist de release (por tag)

- [ ] Gate de testes completo verde (`test_plan.md`, Seção 3).
- [ ] Nenhuma RFC "P0 — bloqueante" (PRD, Seção 3) em status diferente de "Implementado" para uma tag `1.0.0`.
- [ ] `CHANGELOG.md` atualizado (criar na raiz do repo, se ainda não existir, na primeira release).
- [ ] Binários da CLI (`flex`) publicados para as plataformas suportadas (mínimo: Linux x64, o ambiente do ADR-001; macOS/Windows podem ser fast-follow se a v1.0 focar primeiro no alvo de servidor Linux, que é o caso de uso real de produção do PRD).
- [ ] Tag Git assinada e anotada com o resumo do release.

## 5. Política pós-v1.0

- **Deprecação**: qualquer remoção de feature de stdlib passa por um `MINOR` marcando-a como deprecated (aviso em `flex build`/`flex test`, sem quebrar), antes de ser removida em um `MAJOR` subsequente — no mínimo um ciclo `MINOR` de aviso.
- **Suporte**: só a última `MINOR` de cada `MAJOR` recebe correção de bug ativa — sem compromisso de backport para versões `MINOR` antigas dentro do mesmo `MAJOR`, dado o tamanho atual do time.
- **Fast-follows já identificados** (não bloqueiam v1.0, mas são os próximos candidatos naturais, na ordem em que o PRD os menciona): WebSockets, `flex mod` (gerenciador de pacotes remoto, Seção 8 Estágio B do roadmap arquitetural), middleware componível em `net/http`, `flex fmt` completo (se tiver saído incompleto na v1.0).

## 6. O que este plano não cobre

Processo de resposta a incidente de segurança em produção (CVE, disclosure) — a v1.0 ainda não tem usuários externos suficientes para justificar um processo formal de security disclosure; isso é revisitado quando (e se) a adoção externa justificar.
