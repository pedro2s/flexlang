# Walkthrough: Portal de Documentação Oficial da FlexLang

Implementação completa do portal público oficial de documentação técnica e referência da **FlexLang** no diretório [`reference/`](../reference), com suporte nativo a **Internacionalização (Português do Brasil `pt-BR` e Inglês `en`)**, motor **Astro + Starlight**, realce de sintaxe fiel ao VSCode com **Shiki + TextMate**, busca client-side indexada **Pagefind** e automação de deploy contínuo no **GitHub Pages**.

---

## 🌟 O que foi Construído

### 1. Infraestrutura do Portal em [`reference/`](../reference)
- **Framework**: Astro (v5) + `@astrojs/starlight`.
- **Identidade Visual**:
  - Logo vetorial SVG e favicon customizados com o mascote oficial Octans (`reference/src/assets/logo.svg` e `reference/public/favicon.svg`).
  - Tema dark moderno com tipografia técnica (*Outfit* + *Inter* + *JetBrains Mono*) e acentos em neon cyan / electric blue (`reference/src/styles/custom.css`).
- **Syntax Highlighting Oficial**:
  - Integração da gramática TextMate oficial da FlexLang (`editors/vscode/syntaxes/flexlang.tmLanguage.json`) diretamente no Shiki via `reference/astro.config.mjs`.
- **Internacionalização Nativa (i18n)**:
  - Seletor de idioma no topo da página.
  - Rotas espelhadas 1:1 entre Português e Inglês.
  - Indexação e busca Pagefind separadas por idioma (`pt-BR` e `en`).
- **Base Path & GitHub Pages Config**:
  - Configurado `site: 'https://pedro2s.github.io'` e `base: '/flexlang'` para roteamento e assets corretos no GitHub Pages.

---

### 2. Estrutura Completa de Conteúdo (63 Páginas Geradas)

#### 🇧🇷 Português do Brasil (Raiz)
1. **Landing Page**: `reference/src/content/docs/index.mdx`
2. **Início Rápido (Getting Started)**:
   - `reference/src/content/docs/getting-started/overview.md` — Visão Geral & Filosofia da Linguagem
   - `reference/src/content/docs/getting-started/installation.md` — Instalação em 60s (npm, pnpm, yarn, bun)
   - `reference/src/content/docs/getting-started/first-project.md` — Primeiro Projeto em 5 Minutos
   - `reference/src/content/docs/getting-started/ide-setup.md` — Configuração do VSCode e Tooling
3. **O Livro da FlexLang (Language Guide)**:
   - `reference/src/content/docs/book/01-variables-types.md` — Variáveis, Imutabilidade e Constantes
   - `reference/src/content/docs/book/02-primitives-arithmetic.md` — Tipos Primitivos & Aritmética Estrita
   - `reference/src/content/docs/book/03-control-flow.md` — Controle de Fluxo (if, else if, while, for..in)
   - `reference/src/content/docs/book/04-functions-closures.md` — Funções e Closures com Captura Léxica
   - `reference/src/content/docs/book/05-structs-traits.md` — Structs, Métodos e Traits
   - `reference/src/content/docs/book/06-enums-matching.md` — Enums (Sum Types) e Pattern Matching Exaustivo
   - `reference/src/content/docs/book/07-error-handling.md` — Tratamento de Erros (Result, Option, ?, catch)
   - `reference/src/content/docs/book/08-concurrency.md` — Concorrência Estruturada (scope, spawn, Channel)
   - `reference/src/content/docs/book/09-modules.md` — Módulos Locais e flex.toml
4. **Biblioteca Padrão (Stdlib API)**:
   - `reference/src/content/docs/stdlib/http.md` — `net/http` (REST, Middlewares, CORS, Panic Recovery)
   - `reference/src/content/docs/stdlib/postgres.md` — `db/postgres` (Pool, Queries Parametrizadas, Transações)
   - `reference/src/content/docs/stdlib/decimal.md` — `math/decimal` (Aritmética Financeira de Precisão Arbitrária)
   - `reference/src/content/docs/stdlib/time.md` — `core/time` (Time UTC, ISO 8601, Durações)
   - `reference/src/content/docs/stdlib/crypto.md` — `crypto` (Bcrypt, UUID v4, HMAC-SHA256)
   - `reference/src/content/docs/stdlib/env.md` — `os/env` (Variáveis de Ambiente Seguras)
   - `reference/src/content/docs/stdlib/log.md` — `core/log` (JSON Estruturado com Mascaramento de Segredos)
   - `reference/src/content/docs/stdlib/collections.md` — Métodos de String, Array e HashMap
5. **Cookbooks & Casos Reais**:
   - `reference/src/content/docs/cookbooks/flexbank-fintech.md` — Estudo de Caso FlexBank API (Fintech)
   - `reference/src/content/docs/cookbooks/layered-architecture.md` — Arquitetura em Camadas (Le Salvi API)
   - `reference/src/content/docs/cookbooks/docker-deploy.md` — Multi-stage Docker & Deploy em Produção
6. **Comparativos ("Why FlexLang?")**:
   - `reference/src/content/docs/comparisons/flexlang-for-gophers.md` — Para Desenvolvedores Go
   - `reference/src/content/docs/comparisons/flexlang-for-ts-devs.md` — Para Desenvolvedores TypeScript/Node
   - `reference/src/content/docs/comparisons/flexlang-for-rustaceans.md` — Para Desenvolvedores Rust
7. **Toolchain & CLI**:
   - `reference/src/content/docs/cli/commands.md` — Comandos da CLI (`init`, `run`, `build`, `test`, `watch`)
   - `reference/src/content/docs/cli/flex-toml.md` — Especificação do `flex.toml`
   - `reference/src/content/docs/cli/diagnostics.md` — Catálogo de Códigos de Diagnóstico (`E1xxx`, `E2xxx`, `E3xxx`)

#### 🇺🇸 English (`/en/`)
- Espelhamento completo de todas as seções e documentos em `reference/src/content/docs/en/`.

---

### 3. Automação CI/CD no GitHub Actions
Criado o workflow `.github/workflows/docs.yml` para compilação e deploy automático da documentação no **GitHub Pages** a cada push na branch `main`.

---

## 🚀 Como Executar Localmente

No terminal da raiz do projeto:

```bash
# Iniciar servidor de desenvolvimento local
npm run docs:dev

# Compilar para produção
npm run docs:build
```

O site estará disponível em `http://localhost:4321/flexlang/`.
