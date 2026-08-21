# Changelog

Todas as mudanças notáveis do FlexLang são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/) — com a ressalva de que, enquanto `0.x`, `MINOR` pode conter breaking changes sem aviso prévio (ver [`.docs/v1/release_plan.md`](.docs/v1/release_plan.md), Seção 1).

## [Não lançado]

## [0.4.0] - 2026-08-21

Quarta grande release pública da FlexLang. Focada na consolidação da infraestrutura para sistemas distribuídos, resiliência enterprise, streaming de eventos em larga escala, tooling profissional para editores de código e paridade estrita nos dois modos de execução (Node.js e Go). Implementa integralmente as RFCs 031 a 046 (ver [`.docs/v0.4/rfcs/`](.docs/v0.4/rfcs/)).

### Adicionado
- **Cliente HTTP Resiliente e Uploads no Servidor (RFC-031 / RFC-046)**:
  - Cliente HTTP `Client` com pooling de conexões, timeouts granulares e montagem de formulários multipart (`MultipartForm`).
  - Suporte completo no servidor HTTP (`Server` / `Request`) para recebimento de formulários `multipart/form-data` e `application/x-www-form-urlencoded` através de `req.form_value(name)` e `req.form_file(name)` com a estrutura tipada `UploadedFile`.
- **Injeção de Configuração com `config/dotenv` (RFC-032)**: Carregamento e injeção automática de arquivos `.env` com suporte a comentários, aspas simples/duplas e substituição declarativa via `dotenv.load()`, `dotenv.load_file()` e `dotenv.config()`.
- **Serialização e Codificação Multiformato com `encoding` (RFC-033)**: Conversões atômicas JSON (`json.stringify`, `json.parse`), Base64 (`base64.encode`, `base64.decode`) e Hexadecimal (`hex.encode`, `hex.decode`).
- **I/O e Manipulação de Caminhos com `std/fs` e `std/path` (RFC-034)**: Operações completas de arquivos (`read_file`, `write_file`, `append_file`, `exists`, `remove_file`, `create_dir`, `read_dir`) e normalização multiplataforma de diretórios e caminhos (`join`, `dir`, `base`, `ext`, `is_abs`).
- **Autenticação Segura com Tokens JWT via `crypto/jwt` (RFC-035)**: Assinatura, decodificação e validação criptográfica de tokens com HMAC-SHA256 e parsing de claims tipadas.
- **Cache Distribuído e Locks Atômicos com `storage/redis` (RFC-036)**: Driver Redis de alto desempenho com operações chave-valor (`get`, `set`, `set_ex`, `del`, `exists`, `expire`, `ttl`, `incr`, `decr`) e distributed locks atômicos `acquire`/`release` baseados em TTL e token único de dono.
- **Validação Declarativa Fluente com `data/validator` (RFC-037)**: Validador estruturado de payloads com encadeamento de regras (`required`, `email`, `min_len`, `max_len`, `min`, `max`, `pattern`, `uuid`) e retorno acumulado de erros em `ValidationError`.
- **Engenharia de Resiliência Distribuída com `core/resilience` (RFC-038)**: Circuit Breaker de 3 estados (Closed, Open, Half-Open), Retry com Exponential Backoff e Jitter determinístico, e Rate Limiter baseado em Token Bucket.
- **Observabilidade e Tracing Distribuído com `core/telemetry` (RFC-039)**: Métricas Prometheus nativas (`Counter`, `Gauge`, `Histogram`) com exposição em `/metrics` e Rastreamento OpenTelemetry (`Tracer`, `Span`) com injeção/extração de cabeçalhos de contexto W3C `traceparent`.
- **Mensageria e Streaming de Eventos com `mq/kafka` (RFC-040)**: Driver nativo para Apache Kafka com suporte a `Producer` particionado de alto rendimento e `Consumer` concorrente gerenciado por Consumer Groups.
- **Framework de Testes Integrado com `std/testing` e CLI `flex test` (RFC-041)**: Testes unitários com atributos `#[test]`, `#[test(skip)]`, `#[test(timeout_ms = ...)]`, runner concorrente e flags `--native`, `-v`, `--filter`.
- **Motor de Idempotência Financeira com `finance/idempotency` (RFC-042)**: Prevenção de duplicidade transacional Exactly-Once em transferências e liquidações Pix com suporte a Redis e PostgreSQL.
- **Arquitetura de Referência FlexBank Distributed (RFC-043)**: Ecossistema de microsserviços distribuídos (`examples/10_flexbank_distributed`) homologado com 100% de paridade em `tests/flexbank_distributed_integration.ts`.
- **Expressões Regulares RE2 Seguras com `std/regex` (RFC-044)**: Motor de expressões regulares lineares O(N) imunes a ataques ReDoS (`is_match`, `find`, `find_all`, `replace`, `replace_all`, `split`).
- **Agendador de Tarefas Periódicas com `core/scheduler` (RFC-045)**: Scheduler em background para execução de tarefas periódicas via expressões cron de 5/6 campos e intervalos de tempo tipados.
- **Extensão Oficial para Visual Studio Code (`editors/vscode`)**: Syntax highlighting completo (TextMate), Servidor LSP inteligente (diagnósticos estáticos em tempo real, auto-completion, tooltips Markdown para os 15 módulos da Stdlib), CodeLens interativo com ações de teste e formatador oficial integrado.
- **Portal Oficial de Documentação Técnica (`reference/`)**: Guias atualizados de todos os módulos da biblioteca padrão, comparativos detalhados para desenvolvedores TypeScript, Rust e Go, e receitas de produção com Docker.

## [0.3.1] - 2026-08-19

Release de refinamento, lançamento do portal de documentação oficial multilíngue e melhorias na CLI.

### Adicionado
- **Flags de Versão e Ajuda na CLI**: Adicionado suporte às flags `flex --version`, `-v`, `version` e `flex --help`, `-h`, `help` com saída padronizada e amigável.
- **Resolução Dinâmica de Versão na CLI**: A constante `FLEX_VERSION` agora é resolvida dinamicamente a partir do `package.json`, eliminando divergências manuais entre manifesto e binário.
- **Suíte de Testes Automatizados da CLI**: Adicionado `tests/49_cli_version.ts` validando o comportamento de todas as flags e variações de comandos de versão e ajuda.
- **Portal Oficial de Documentação (Astro v5 + Starlight)**: Criado portal completo de referência técnica em `reference/` hospedado no GitHub Pages ([https://pedro2s.github.io/flexlang/](https://pedro2s.github.io/flexlang/)), com suporte nativo a internacionalização (Português do Brasil `pt-BR` e Inglês `en`), gramática TextMate oficial da FlexLang no Shiki, e suporte a temas claro e escuro.
- **Pipeline CI/CD de Deploy da Documentação**: Criado workflow `.github/workflows/docs.yml` para compilação e deploy contínuo das documentações no GitHub Pages.

### Modificado
- **README.md Internacional**: Transcrição integral do `README.md` para o Inglês, facilitando a adoção global da linguagem, com badges oficiais, links do portal e catálogo de exemplos.
- **Atualização da Sintaxe de Pattern Matching nas Referências**: Removido o operador legado `=>` em todas as páginas de documentação de `match` e `enums`, padronizando os exemplos com a sintaxe oficial de blocos `{ ... }`.
- **Documentação de Observabilidade em `net/http`**: Documentação detalhada dos recursos corporativos do servidor HTTP: endpoint de health check nativo (`/healthz`), isolamento e recuperação automática de panics, tracing estruturado com `core/log` e desligamento gracioso (*graceful shutdown*) com `server.on_shutdown()`.

## [0.3.0] - 2026-08-18

Terceira release pública da FlexLang. Focada em backend enterprise, precisão financeira, observabilidade e ergonomia de código moderno. Implementa integralmente as RFCs 017 a 030 (ver [`.docs/v0.3/rfcs/`](.docs/v0.3/rfcs/)).

### Adicionado
- **Controle de Fluxo Estendido (RFC-017)**: Adicionadas cláusulas `else if` sem aninhamento excessivo e instruções `break` e `continue` com validação estática de escopo dentro de laços (`while` e `for`).
- **Laços `for..in` sobre Coleções (RFC-018)**: Iteração idiomática `for item in collection` sobre arrays (`[T]`), mapas (`HashMap`/`Map`), strings (`String`) e ranges numéricos (`a..b`).
- **Métodos Nativos de `String` (RFC-019)**: Métodos nativos `.len()`, `.trim()`, `.upper()`, `.lower()`, `.contains()`, `.split()`, `.replace()`, `.substring()` e `.index_of()` com retorno em `Option<Int>`.
- **Métodos Nativos de `Array` e Programação Funcional (RFC-020)**: Métodos `.len()`, `.is_empty()`, `.contains()`, `.slice()`, `.concat()`, `.push()`, `.pop()`, `.sort()`, `.map()`, `.filter()`, `.find()` e `.for_each()` operando com closures.
- **Closures com Captura de Escopo Lexical (RFC-021)**: Lambdas e closures com sintaxe `|param: Type| { ... }`, captura de variáveis externas por referência e suporte a funções de alta ordem aninhadas.
- **Conversões de Tipo Explícitas e Parsing (RFC-022)**: Métodos `.to_string()` para primitivos (`Int`, `Float`, `Bool`) e funções livres `parse_int(s)` e `parse_float(s)` com retornos `Result<Int, String>` e `Result<Float, String>`.
- **Coleção `HashMap<K, V>` Tipada (RFC-023)**: Tipo de dicionário em memória com métodos `new()`, `from()`, `.get(key) -> Option<V>`, `.set(key, val)`, `.remove(key) -> Option<V>`, `.contains_key(key) -> Bool`, `.keys()`, `.values()`, `.len()` e `.is_empty()`.
- **Declarações `const` de Nível de Módulo (RFC-024)**: Palavra-chave `const` para imutabilidade estrita em tempo de compilação, validação contra reatribuição e proibição de chamadas com efeitos colaterais na inicialização.
- **Módulo `math/decimal` para Precisão Financeira (RFC-025)**: Tipo `Decimal` de ponto fixo/arbitrário para operações monetárias exatas, com `.add()`, `.sub()`, `.mul()`, `.div()`, `.pow()`, `.round()`, comparações (`eq`, `lt`, `gt`) e conversão para string.
- **Módulo `os/env` para Variáveis de Ambiente (RFC-026)**: Acesso seguro ao ambiente com `env.get(key) -> Option<String>`, `env.get_or(key, default) -> String`, `env.require(key) -> String` e `env.has(key) -> Bool`.
- **Módulo `core/time` para Datas e Durações (RFC-027)**: Tipos `Time` (epoch unix, layouts customizados e ISO 8601) e `Duration` (construtores `seconds`, `millis`, `minutes`, `hours` e métodos de conversão).
- **Módulo `crypto` para Criptografia e Segurança (RFC-028)**: Hashing seguro de senhas com `hash.bcrypt` e `hash.bcrypt_verify`, geração de identificadores `uuid.v4`, proteção contra timing attacks com `hmac.sha256`/`hmac.verify` e função livre `sha256(data)`.
- **Expressões `catch` para Tratamento de Erros Inline (RFC-029)**: Sintaxe `<expr> catch err { <bloco> }` para interceptar variantes `Result.Err`, vincular erros em variáveis e fornecer valores de fallback, retries ou re-propagação ergonômica.
- **Projeto de Referência FlexBank API e Homologação (RFC-030)**: Projeto completo `examples/09_flexbank_api` e suíte de integração ponta a ponta `tests/flexbank_integration.ts` com 66 cenários HTTP executados e aprovados nos modos interpretado e compilado Go.

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

[Não lançado]: https://github.com/pedro2s/flexlang/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/pedro2s/flexlang/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/pedro2s/flexlang/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/pedro2s/flexlang/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pedro2s/flexlang/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pedro2s/flexlang/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pedro2s/flexlang/releases/tag/v0.1.0
