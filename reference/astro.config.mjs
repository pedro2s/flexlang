import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import fs from 'node:fs';
import path from 'node:path';

// Carrega a gramática oficial TextMate do FlexLang para o Shiki
const grammarPath = path.resolve('../editors/vscode/syntaxes/flexlang.tmLanguage.json');
let flexGrammar = {};
try {
  if (fs.existsSync(grammarPath)) {
    flexGrammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));
    flexGrammar.name = 'flex';
    flexGrammar.aliases = ['flexlang', 'source.flex'];
  }
} catch (e) {
  console.warn('Não foi possível carregar a gramática TextMate do FlexLang:', e);
}

export default defineConfig({
  site: 'https://pedro2s.github.io',
  base: '/flexlang',
  integrations: [
    starlight({
      title: 'FlexLang Docs',
      description: 'A linguagem definitiva para Backends Escaláveis, Seguros e Altamente Performáticos.',
      logo: {
        src: './src/assets/logo.svg',
      },
      favicon: '/favicon.svg',
      social: {
        github: 'https://github.com/pedro2s/flexlang',
      },
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'Português (Brasil)',
          lang: 'pt-BR',
        },
        en: {
          label: 'English',
          lang: 'en',
        },
      },
      customCss: [
        './src/styles/custom.css',
      ],
      expressiveCode: {
        shiki: {
          langs: Object.keys(flexGrammar).length > 0 ? [flexGrammar] : [],
        },
      },
      sidebar: [
        {
          label: '🚀 Início Rápido',
          translations: {
            en: '🚀 Getting Started',
          },
          items: [
            { label: 'Visão Geral & Filosofia', slug: 'getting-started/overview', translations: { en: 'Overview & Philosophy' } },
            { label: 'Instalação em 60s', slug: 'getting-started/installation', translations: { en: 'Installation in 60s' } },
            { label: 'Seu Primeiro Projeto', slug: 'getting-started/first-project', translations: { en: 'Your First Project' } },
            { label: 'Configuração do VSCode', slug: 'getting-started/ide-setup', translations: { en: 'VSCode Setup' } },
          ],
        },
        {
          label: '📖 O Livro da FlexLang',
          translations: {
            en: '📖 The FlexLang Book',
          },
          items: [
            { label: '1. Variáveis, Imutabilidade e Constantes', slug: 'book/01-variables-types', translations: { en: '1. Variables, Mutability & Const' } },
            { label: '2. Tipos Primitivos & Aritmética', slug: 'book/02-primitives-arithmetic', translations: { en: '2. Primitive Types & Arithmetic' } },
            { label: '3. Controle de Fluxo', slug: 'book/03-control-flow', translations: { en: '3. Control Flow' } },
            { label: '4. Funções e Closures', slug: 'book/04-functions-closures', translations: { en: '4. Functions & Closures' } },
            { label: '5. Structs, Métodos e Traits', slug: 'book/05-structs-traits', translations: { en: '5. Structs, Methods & Traits' } },
            { label: '6. Enums e Pattern Matching', slug: 'book/06-enums-matching', translations: { en: '6. Enums & Pattern Matching' } },
            { label: '7. Tratamento de Erros Moderno', slug: 'book/07-error-handling', translations: { en: '7. Modern Error Handling' } },
            { label: '8. Concorrência Estruturada', slug: 'book/08-concurrency', translations: { en: '8. Structured Concurrency' } },
            { label: '9. Módulos Locais e flex.toml', slug: 'book/09-modules', translations: { en: '9. Local Modules & flex.toml' } },
          ],
        },
        {
          label: '📚 Biblioteca Padrão (Stdlib)',
          translations: {
            en: '📚 Standard Library (Stdlib)',
          },
          items: [
            { label: 'net/http — Servidores & Clientes HTTP', slug: 'stdlib/http', translations: { en: 'net/http — HTTP Servers & Clients' } },
            { label: 'config/dotenv — Variáveis de Ambiente', slug: 'stdlib/dotenv', translations: { en: 'config/dotenv — Environment Config' } },
            { label: 'encoding — JSON, Base64 & Hex', slug: 'stdlib/encoding', translations: { en: 'encoding — JSON, Base64 & Hex' } },
            { label: 'std/fs & std/path — Arquivos e Diretórios', slug: 'stdlib/fs-path', translations: { en: 'std/fs & std/path — Files & Paths' } },
            { label: 'crypto/jwt — Tokens JWT & Segurança', slug: 'stdlib/jwt', translations: { en: 'crypto/jwt — JWT Tokens & Security' } },
            { label: 'storage/redis — Driver Redis Nativo', slug: 'stdlib/redis', translations: { en: 'storage/redis — Native Redis Driver' } },
            { label: 'db/postgres — Driver PostgreSQL', slug: 'stdlib/postgres', translations: { en: 'db/postgres — PostgreSQL Driver' } },
            { label: 'math/decimal — Aritmética Financeira', slug: 'stdlib/decimal', translations: { en: 'math/decimal — Arbitrary Precision' } },
            { label: 'data/validator — Validação Declarativa', slug: 'stdlib/validator', translations: { en: 'data/validator — Declarative Validation' } },
            { label: 'core/resilience — Circuit Breaker & Retry', slug: 'stdlib/resilience', translations: { en: 'core/resilience — Circuit Breaker & Retry' } },
            { label: 'core/telemetry — Métricas & OpenTelemetry', slug: 'stdlib/telemetry', translations: { en: 'core/telemetry — Metrics & OpenTelemetry' } },
            { label: 'mq/kafka — Mensageria de Eventos', slug: 'stdlib/kafka', translations: { en: 'mq/kafka — Event Messaging' } },
            { label: 'std/testing — Testes Unitários Nativos', slug: 'stdlib/testing', translations: { en: 'std/testing — Native Unit Testing' } },
            { label: 'finance/idempotency — Motor de Idempotência', slug: 'stdlib/idempotency', translations: { en: 'finance/idempotency — Idempotency Engine' } },
            { label: 'std/regex — Expressões Regulares RE2', slug: 'stdlib/regex', translations: { en: 'std/regex — RE2 Regular Expressions' } },
            { label: 'core/scheduler — Agendador & Cron', slug: 'stdlib/scheduler', translations: { en: 'core/scheduler — Background & Cron' } },
            { label: 'core/time — Tempo & Durações', slug: 'stdlib/time', translations: { en: 'core/time — Time & Durations' } },
            { label: 'crypto — Criptografia & Hashes', slug: 'stdlib/crypto', translations: { en: 'crypto — Cryptography & Hashes' } },
            { label: 'os/env — Sistema Operacional & Env', slug: 'stdlib/env', translations: { en: 'os/env — OS & Environment' } },
            { label: 'core/log — Logging Estruturado', slug: 'stdlib/log', translations: { en: 'core/log — Structured Logging' } },
            { label: 'Coleções (String, Array, HashMap)', slug: 'stdlib/collections', translations: { en: 'Collections (String, Array, HashMap)' } },
          ],
        },
        {
          label: '💡 Cookbooks & Casos Reais',
          translations: {
            en: '💡 Cookbooks & Real Cases',
          },
          items: [
            { label: 'Microsserviços: FlexBank Distributed', slug: 'cookbooks/flexbank-distributed', translations: { en: 'Microservices: FlexBank Distributed' } },
            { label: 'Fintech Enterprise: FlexBank API', slug: 'cookbooks/flexbank-fintech', translations: { en: 'Enterprise Fintech: FlexBank API' } },
            { label: 'API REST em Camadas (Le Salvi)', slug: 'cookbooks/layered-architecture', translations: { en: 'Layered REST API (Le Salvi)' } },
            { label: 'Deploy em Produção & Docker', slug: 'cookbooks/docker-deploy', translations: { en: 'Production Deploy & Docker' } },
          ],
        },
        {
          label: '⚖️ Comparativos ("Why FlexLang?")',
          translations: {
            en: '⚖️ Comparisons ("Why FlexLang?")',
          },
          items: [
            { label: 'FlexLang para Desenvolvedores Go', slug: 'comparisons/flexlang-for-gophers', translations: { en: 'FlexLang for Go Developers' } },
            { label: 'FlexLang para Desenvolvedores TypeScript', slug: 'comparisons/flexlang-for-ts-devs', translations: { en: 'FlexLang for TypeScript Devs' } },
            { label: 'FlexLang para Desenvolvedores Rust', slug: 'comparisons/flexlang-for-rustaceans', translations: { en: 'FlexLang for Rustaceans' } },
          ],
        },
        {
          label: '🛠️ Toolchain & CLI',
          translations: {
            en: '🛠️ Toolchain & CLI',
          },
          items: [
            { label: 'Comandos da CLI (run, build, test, check)', slug: 'cli/commands', translations: { en: 'CLI Commands (run, build, test, check)' } },
            { label: 'Manifesto flex.toml', slug: 'cli/flex-toml', translations: { en: 'flex.toml Manifest' } },
            { label: 'Guia de Diagnósticos de Erro', slug: 'cli/diagnostics', translations: { en: 'Compiler Diagnostics Guide' } },
          ],
        },
      ],
    }),
  ],
});
