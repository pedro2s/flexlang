# RFC-010: CI/CD de Release, Publicação npm e GitHub Releases

> **Status:** Draft · **Prioridade:** P0 — bloqueante para o lançamento público · **Depende de:** RFC-007 (CLI), todas as demais RFCs 001–009 já implementadas
> **Relacionado:** [`release_plan.md`](../release_plan.md) (política e processo), [`codenames.json`](../../codenames.json) (mapeamento de codinomes)

## Resumo

As RFCs 001–009 fecham a linguagem e a stdlib. Esta RFC fecha a **distribuição**: como um `git push --follow-tags` de uma tag `vX.Y.Z` vira, sem intervenção manual, um pacote publicado em `npm install -g @flexlang/cli` e uma GitHub Release no formato usado pelo Bun (instruções de instalação/upgrade, link de notas, lista de contribuidores).

## Motivação

Hoje `flex` só roda a partir do checkout do repositório (`npx tsx src/cli.ts`, ou o script `bin` do `package.json` apontando para o `.ts` cru via shebang `#!/usr/bin/env -S npx tsx`). Isso funciona para quem clona o repo, mas **não funciona para um usuário publicado via npm** — o consumidor final não tem `tsx` nem os `devDependencies` do projeto instalados, e mesmo que tivesse, rodar TypeScript não-transpilado via subprocesso a cada invocação de CLI é uma experiência de startup lenta e frágil para o "estilo nestjs/cli" que o objetivo pede.

## Não-objetivos

- **Não** cobre distribuição de binário nativo standalone (estilo `curl | bash` do Bun) — fora de escopo desta rodada (ver `release_plan.md`, Seção 8). A CLI é, e continua sendo por ora, um pacote Node normal.
- **Não** automatiza a decisão de "quando" cortar uma release nem "qual" o próximo número de versão — isso continua sendo uma decisão humana (`release_plan.md`, Seção 5). Esta RFC automatiza o que acontece **depois** que a tag é empurrada, não a decisão de empurrá-la.
- **Não** implementa npm "Trusted Publishing" (OIDC, sem token de longa duração) nesta primeira versão — é a evolução natural do passo de publicação (ver "Riscos"), mas o método de token clássico é suficiente e mais simples de configurar agora.

## Design Detalhado

### 1. Identidade do pacote e ajustes em `package.json`

Renomear o pacote para `@flexlang/cli` (ver `release_plan.md`, Seção 2, para o porquê do escopo) e corrigir o `bin` para apontar a um artefato **compilado**, não ao `.ts` cru:

```jsonc
{
  "name": "@flexlang/cli",
  "version": "0.1.0",
  "bin": { "flex": "./dist/cli.js" },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/cli.ts --format esm --target node22 --clean --shims",
    "prepublishOnly": "npm run build"
  }
}
```

- **`tsup`** (wrapper fino sobre o `esbuild`) faz bundle de todo o grafo de módulos (`ast.ts`, `checker.ts`, `interpreter.ts`, `lexer.ts`, `loader.ts`, `parser.ts`, `stdlib.ts`, `transpiler.ts`, `modules/*`) em um único `dist/cli.js` — inicialização de CLI publicada não deve depender de resolução de módulo ESM espalhada por 10+ arquivos a cada `npx flex`.
- **`prepublishOnly`** garante que `npm publish` nunca publica sem rodar o build antes — mesmo se alguém rodar o comando manualmente fora do CI.
- **`files: ["dist"]`** — o pacote publicado não carrega `src/`, `tests/`, `examples/`, `.docs/`; só o artefato de execução. Reduz o tamanho do pacote e a superfície do que é "API pública" do ponto de vista de quem instala.
- O shebang do `dist/cli.js` gerado passa a ser `#!/usr/bin/env node` (o `tsup` com `--shims`/banner de shebang cuida disso) — nada de `npx tsx` no artefato publicado.

### 2. `ci.yml` (existente) vira reutilizável

O workflow de CI já existente (`.github/workflows/ci.yml`) já roda golden-file + parity gate com Node e Go configurados — é exatamente o gate que uma release não pode pular. Em vez de duplicar essa lógica dentro do workflow de release, `ci.yml` ganha um gatilho `workflow_call`, para ser chamado como um job de dependência:

```yaml
# .github/workflows/ci.yml — só o "on:" muda
on:
  push:
    branches: [main]
  pull_request:
  workflow_call: {}
```

### 3. `release.yml` — o pipeline novo, disparado por tag

```yaml
name: Release

on:
  push:
    tags: ["v*.*.*"]

permissions:
  contents: write   # criar a GitHub Release

jobs:
  test:
    uses: ./.github/workflows/ci.yml

  publish:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # histórico completo: precisa p/ contribuidores e changelog

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"

      - run: npm ci

      - name: Verifica que a tag bate com package.json
        run: |
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          PKG_VERSION=$(node -p "require('./package.json').version")
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            echo "::error::Tag v$TAG_VERSION não bate com package.json ($PKG_VERSION). Rode 'npm version' antes de taguear."
            exit 1
          fi

      - run: npm run build

      - name: Publica @flexlang/cli no npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Gera as notas de release (estilo Bun)
        id: notes
        run: node scripts/generate-release-notes.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Cria a GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          name: ${{ steps.notes.outputs.title }}
          body_path: release-notes.md
```

O passo "Verifica que a tag bate com `package.json`" existe porque a alternativa (confiar que o mantenedor sempre lembra de rodar `npm version` antes de taguear) é exatamente o tipo de disciplina manual que falha sob pressão de release — falhar ruidosamente aqui é mais barato que publicar uma versão errada no npm.

### 4. `scripts/generate-release-notes.mjs` — o formato "estilo Bun"

Reproduzido no exemplo do usuário: título com o codinome, "To install"/"To upgrade" com blocos de comando, link para as notas completas, e "Thanks to N contributors!" com menções. GitHub já mostra automaticamente, na própria página da Release (fora do corpo markdown), quem disparou o release e o commit/tag — não precisamos gerar isso. O que o script gera é só o **corpo**:

```md
## Instalar o FlexLang 0.2.0

​```bash
npm install -g @flexlang/cli@0.2.0
​```

Ou use via `npx`, sem instalar globalmente:

​```bash
npx @flexlang/cli@0.2.0
​```

## Atualizar

​```bash
npm install -g @flexlang/cli@latest
​```

Leia as notas completas em [CHANGELOG.md](https://github.com/pedro2s/flexlang/blob/main/CHANGELOG.md#020)

## Agradecimentos

Obrigado aos 4 colaboradores desta versão!

@pedro2s @colaborador2 @colaborador3 @colaborador4
```

Para uma versão `1.x` com codinome, o título gerado (`steps.notes.outputs.title`, via `GITHUB_OUTPUT`) é `FlexLang v1.1.0 "Saiph"` — lido de `codenames.json` pela chave `MAJOR.MINOR`; se a chave não existir (qualquer `0.x`, ou um `1.x` cuja linha não foi cadastrada), o título cai para `FlexLang v0.2.0`, sem quebrar o pipeline por falta de codinome.

**Lista de contribuidores**: o script pega os commits entre a tag anterior e a atual (`git log <tag_anterior>..<tag_atual>`), e para cada hash consulta `GET /repos/{owner}/{repo}/commits/{sha}` da API do GitHub (usando o `GITHUB_TOKEN` do próprio Actions, sem PAT adicional) para resolver `author.login` — o mesmo dado que a página de Release do GitHub usa nativamente, só reempacotado no formato do corpo customizado.

## Plano de Testes

1. Testar o workflow completo em uma tag de pré-release (`v0.1.0-rc.1`, que **não** deve publicar como `latest` no npm — usar `npm publish --tag rc` para tags com `-` no nome, detectado automaticamente pelo script a partir do `GITHUB_REF_NAME`).
2. Simular uma tag cujo `package.json` está dessincronizado — o job `publish` deve falhar no passo de verificação, **antes** de rodar `npm publish`.
3. Validar que o pacote publicado, instalado globalmente em um container limpo (`npm install -g @flexlang/cli`), expõe `flex` funcional (`flex run examples/01_hello_http.flex`) sem `tsx`/`typescript` instalados no ambiente do consumidor.
4. Validar que a GitHub Release gerada tem o título com codinome correto para uma tag `1.x` cadastrada em `codenames.json`, e sem codinome para uma tag `0.x`.

## Critério de Aceite

- [ ] `git push --follow-tags` de uma tag `vX.Y.Z` publica `@flexlang/cli@X.Y.Z` no npm e cria a GitHub Release correspondente, sem passo manual adicional.
- [ ] `npm install -g @flexlang/cli` (fora do monorepo, em um ambiente limpo) expõe um comando `flex` funcional.
- [ ] A publicação falha ruidosamente (sem publicar nada) se o gate de testes (`ci.yml`) ou a verificação de versão falhar.
- [ ] O corpo da GitHub Release segue o formato definido (instalar/atualizar/notas/contribuidores), com o codinome correto quando aplicável.

## Riscos e Alternativas Consideradas

- **Alternativa descartada — automação total de versionamento (semantic-release/changesets decidindo o bump)**: rejeitada porque o esquema de codinomes (Seção 1.1 do `release_plan.md`) é uma escolha editorial deliberada — não faz sentido um bot decidir sozinho que a próxima versão é `1.2.0` e o codinome ser resolvido depois. O corte de versão continua sendo decisão humana; só a publicação é automática.
- **Risco de segurança — token de publicação npm de longa duração como secret**: aceito por ora (é o método padrão e amplamente usado), mas registrado como candidato de melhoria: migrar para "Trusted Publishing" do npm (autenticação via OIDC do próprio GitHub Actions, sem secret de longa duração armazenado) assim que a configuração desse fluxo estiver madura o suficiente para não arriscar travar um release por causa de uma feature de auth ainda nova.
- **Risco**: resolver `author.login` via API do GitHub para cada commit é uma chamada por commit — aceitável para o volume de commits entre releases de um projeto deste tamanho; se isso um dia virar gargalo (centenas de commits por release), a alternativa é usar `git shortlog -sne` e aceitar nomes de commit em vez de handles do GitHub como fallback.
