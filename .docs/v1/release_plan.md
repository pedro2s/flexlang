# Plano de Release — FlexLang

> **Status:** Draft · **Relacionado:** [`prd.md`](prd.md) (Definition of Done), [`test_plan.md`](test_plan.md) (gate de qualidade), [RFC-010](rfcs/rfc-010-release-cicd-npm-publish.md) (implementação do CI/CD)

## 1. Versionamento

A FlexLang publica sua primeira versão pública como **`0.1.0`**, não `1.0.0` — mesmo com todas as RFCs da v1 (001–009) implementadas. É uma decisão deliberada, não timidez: todo o trabalho de design foi validado internamente, mas nenhum usuário externo rodou a linguagem em produção ainda. A trilha `0.x` existe exatamente para isso — dar espaço para que a superfície pública (nomes de API da stdlib, formato de erro, shape do `flex.toml`) absorva o atrito real de uso antes de vir a garantia de estabilidade que `1.0.0` representa. Segue o padrão adotado pela esmagadora maioria de linguagens/ferramentas open-source relevantes (Rust pré-1.0, Go pré-1.0, Bun ficou anos em `0.x`).

- **Enquanto `0.x`**: qualquer `MINOR` (`0.1` → `0.2`) pode ter breaking change sem aviso prévio — é o contrato implícito do `0.x` do SemVer. `PATCH` (`0.1.0` → `0.1.1`) continua significando só correção de bug.
- **A partir de `1.0.0`**: `MAJOR.MINOR.PATCH` estrito. Breaking change de sintaxe ou de comportamento observável da stdlib exige `MAJOR` novo; `MINOR` é aditivo e compatível; `PATCH` é só correção.
- **Critério de corte para `1.0.0`**: os mesmos da Seção 2 abaixo — não é uma data, é uma condição.

### 1.1 Codinomes (a partir de `1.0.0`)

Cada versão `1.0` recebe uma identidade visual forte para dar à FlexLang o storytelling de logo/tema de documentação que projetos como Ubuntu ou Android têm — mas com uma estrutura hierárquica pensada especificamente para casar `MAJOR`/`MINOR`, em vez de uma lista arbitrária de nomes:

- **`MAJOR` = uma constelação.** `v1.x` é a era **Orion**.
- **`MINOR` = uma estrela dentro dessa constelação.** `v1.0` é **Orion** (a constelação empresta o nome à sua primeira estrela/versão); `v1.1` é **Saiph**; `v1.2` seria **Rigel**; e assim por diante, esgotando as estrelas mais reconhecíveis da constelação antes de a próxima `MAJOR` adotar uma constelação nova.
- **`PATCH` não recebe codinome novo** — `v1.1.1`, `v1.1.2` continuam sendo "Saiph" (mesmo padrão do Ubuntu: `22.04.1` e `22.04.2` continuam "Jammy Jellyfish").
- **`0.x` não recebe codinome** — o storytelling é reservado para o que já é estável; codinomear pré-releases dilui o significado de "chegar em 1.0".

O mapeamento fica em [`codenames.json`](../../codenames.json), na raiz do repositório — um arquivo plano, editado manualmente por quem decide cortar a release (não é gerado automaticamente, é uma escolha editorial deliberada, igual a decisão de código-fonte).

| Versão | Codinome | Constelação |
|---|---|---|
| `1.0` | Orion | Orion |
| `1.1` | Saiph | Orion |
| `1.2` | Rigel | Orion |
| `1.3` | Bellatrix | Orion |
| `1.4` | Mintaka | Orion |
| `1.5` | Alnilam | Orion |
| `1.6` | Alnitak | Orion |
| `1.7` | Meissa | Orion |
| `2.0` | *(a definir — próxima constelação)* | — |

Só a linha `1.0` precisa existir em `codenames.json` no dia do primeiro release estável; o restante da tabela acima é o plano de nomes, não um compromisso de que `v1.1`..`v1.7` vão de fato existir — cada `MINOR` real ganha sua linha no arquivo no momento em que é cortada.

## 2. Identidade do pacote

A CLI é distribuída via npm, no mesmo padrão do `@nestjs/cli` que inspirou este projeto: **`@flexlang/cli`** (escopo `@flexlang`), não um pacote sem escopo. Verificado diretamente no registro do npm: `flex` e `flexlang` (sem escopo) já estão ocupados por pacotes de terceiros não relacionados — um deles um projeto abandonado desde 2016 chamado, coincidentemente, "flexlang" (`v0.0.1`, "Toy Programming Language"). Disputar esses nomes via processo de nome do npm é lento e incerto; o escopo `@flexlang/cli` resolve isso e, por ser o mesmo padrão do NestJS, comunica a inspiração de forma direta.

- `npm install -g @flexlang/cli` → expõe o comando global `flex` (o nome do `bin` dentro do pacote é independente do nome do pacote).
- `npx @flexlang/cli run app.flex` → funciona sem instalação prévia, exatamente como `npx @nestjs/cli new`.

Ver [RFC-010](rfcs/rfc-010-release-cicd-npm-publish.md) para o que muda em `package.json` para isso funcionar de verdade (hoje o `bin` aponta para um `.ts` cru via shebang `npx tsx`, o que não é aceitável para quem instala o pacote publicado).

## 3. O que é "v1.0.0 GA" (General Availability)

v1.0.0 é a primeira tag que qualquer time pode usar em produção com confiança — não é `0.1.0`, que é deliberadamente uma primeira exposição pública para coletar atrito real, não uma promessa de estabilidade. `1.0.0` é "GA", não "beta", quando:

1. Todos os itens P0 da tabela do PRD (Seção 3) estão fechados — já são, mas GA também exige que tenham sobrevivido a uso externo real na trilha `0.x`, não só à suíte de testes interna.
2. O gate de testes completo (`test_plan.md`, Seção 3) está verde.
3. O caso de uso de referência do PRD (Seção 2) rodou em staging por 24h sem incidente (métrica de sucesso do PRD, Seção 6) — idealmente rodado por um usuário externo real da trilha `0.x`, não só internamente.
4. A documentação pública (README + este conjunto de RFCs, mantido como changelog de decisões) está atualizada para refletir o comportamento real da versão — nenhuma RFC "Draft"/"Implementado" desatualizada.

## 4. Canais de release (deliberadamente simples)

Só dois canais — nada de nightly/canary/beta paralelos, que exigem infraestrutura de release desproporcional para o tamanho atual do projeto:

- **`main`**: sempre no estado mais recente testado (gate do `test_plan.md` verde em todo commit).
- **Tags `vX.Y.Z`**: pontos de release, publicadas automaticamente no npm e no GitHub Releases pelo CI (RFC-010) assim que a tag é empurrada — o gatilho manual é a tag, tudo depois dela é automático.

## 5. Processo de corte de release (o que o mantenedor faz manualmente)

1. Se a versão for `1.x` ou superior (codinome novo): adicionar a entrada em [`codenames.json`](../../codenames.json) e commitar (`chore: registra codinome <Nome> para vX.Y`).
2. Rodar `npm version <newversion>` — atualiza `package.json`, cria o commit de bump e a tag anotada `vX.Y.Z` localmente, em um único passo.
3. `git push --follow-tags` — o push da tag é o gatilho que aciona o RFC-010 (build, gate de testes, publicação no npm, GitHub Release no estilo Bun).
4. Acompanhar a Action em execução; ela falha (e não publica nada) se o gate de testes ou a verificação de versão falhar.

Nenhum passo desta lista precisa de acesso direto ao npm — o token de publicação vive só como secret do GitHub Actions (ver RFC-010).

## 6. Checklist de release (por tag)

- [ ] Gate de testes completo verde (`test_plan.md`, Seção 3) — verificado pelo CI antes de qualquer publicação, não manualmente.
- [ ] Para uma tag `1.0.0`: nenhuma RFC "P0 — bloqueante" (PRD, Seção 3) em status diferente de "Implementado".
- [ ] `CHANGELOG.md` atualizado com a seção da nova versão antes de criar a tag.
- [ ] Para `MINOR`/`MAJOR` a partir de `1.0`: linha correspondente existe em `codenames.json`.
- [ ] `npm version` e `git push --follow-tags` executados — o resto (build, teste, publish, GitHub Release) é automático via RFC-010.

## 7. Política pós-v1.0

- **Deprecação**: qualquer remoção de feature de stdlib passa por um `MINOR` marcando-a como deprecated (aviso em `flex build`/`flex test`, sem quebrar), antes de ser removida em um `MAJOR` subsequente — no mínimo um ciclo `MINOR` de aviso.
- **Suporte**: só a última `MINOR` de cada `MAJOR` recebe correção de bug ativa — sem compromisso de backport para versões `MINOR` antigas dentro do mesmo `MAJOR`, dado o tamanho atual do time.
- **Fast-follows já identificados** (não bloqueiam v1.0, mas são os próximos candidatos naturais, na ordem em que o PRD os menciona): WebSockets, `flex mod` (gerenciador de pacotes remoto, Seção 8 Estágio B do roadmap arquitetural), middleware componível em `net/http`, `flex fmt` completo (se tiver saído incompleto na v1.0).

## 8. O que este plano não cobre

- Binários nativos compilados (estilo `curl | bash` do Bun) — a v1.0 distribui só via npm/npx (RFC-010); um instalador de binário standalone é um fast-follow natural, não um bloqueio, dado que `flex` já é um CLI Node leve o suficiente para `npx` ser uma experiência de instalação aceitável.
- Processo de resposta a incidente de segurança em produção (CVE, disclosure) — a v1.0 ainda não tem usuários externos suficientes para justificar um processo formal de security disclosure; isso é revisitado quando (e se) a adoção externa justificar.
