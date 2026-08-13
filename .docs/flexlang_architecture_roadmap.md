# FlexLang: Roadmap Arquitetural para Backends Escaláveis

> **Rev. 3 — agosto/2026.** Revisado após nova análise da base de código: as Fases 0–2 foram implementadas e a Fase 3 está parcialmente entregue desde a Rev. 2. Este documento é a fonte de verdade da arquitetura da FlexLang; onde houver conflito com o README (em especial numeração de fases), vale o que está aqui.

Avaliada a estrutura atual da **FlexLang** — que deixou de ser um interpretador de bolso e passou a ter type checker, motor de concorrência estruturada, traits, transpiler Go e CLI unificada — a separação clara entre dados e comportamento segue sendo a base de uma linguagem previsível e sustentável. Este documento registra as decisões arquiteturais e o plano de evolução (Fases 0 a 5) rumo ao objetivo: uma linguagem robusta, performática e escalável para backends.

Em uma frase, o alvo é **"um Go com sistema de tipos melhor"** — GC + green threads + `Result`/`match` — somando, desde o dia zero, duas lições que o ecossistema Go aprendeu tarde demais: **concorrência estruturada** e **backpressure por padrão**.

---

## Estado Atual da Implementação (pós Fases 0–2, Fase 3 em andamento)

Desde a Rev. 2, a FlexLang deixou de ser só uma especificação: as Fases 0, 1 e 2 foram implementadas e a Fase 3 está parcialmente entregue. O que existe hoje, de fato, rodando:

- **Lexer** (`src/lexer.ts`) — tokens com linha/coluna; comentários de linha e de bloco; strings com interpolação (`"Olá, ${nome}"`) parseadas via sub-lexer/sub-parser recursivo; operadores completos (`- * / % ! != <= >= && ||`).
- **Parser** (`src/parser.ts`) — expression statements e atribuição (`AssignmentExpr`) — o gap identificado na Rev. 2 foi fechado; precedência completa (`or → and → igualdade → relacional → aditivo → multiplicativo → unário → postfix`); arrays (`ArrayLiteral`/`IndexExpr`); `while`; `enum` com payload posicional; `match` (apenas sobre variantes de enum, sem guards/wildcard `_` ainda); `scope`/`spawn`; `trait` e `impl Trait for Struct`; `import { A, B } from "modulo"`.
- **Type Checker** (`src/checker.ts`) — dois passes (hoisting de structs/funcs/enums/traits, depois checagem profunda); inferência local; enforcement de `mut` em variáveis, parâmetros e alvos de atribuição (`Identifier`/`MemberExpr`/`IndexExpr`); **exhaustiveness checking real** no `match`; validação de conformidade de `trait`; generics representados estruturalmente (`Struct`/`Enum` com `genericArgs`), mas sem verificação de bounds.
- **Interpretador** (`src/interpreter.ts`) — motor 100% assíncrono (`async/await` sobre Promises do Node simulando green threads); **closures agora capturam o ambiente de definição** (`FlexFunction` guarda a declaração + o closure) — o bug de escopo dinâmico da Rev. 2 foi corrigido; `scope`/`spawn` via `Promise.all`/`Promise.race` (deadline vira timeout real); `FlexChannel` com rendezvous síncrono (capacidade 0); `FlexServer` envolvendo o módulo `http` nativo do Node para servir `net/http` em modo interpretado.
- **Transpiler Go** (`src/transpiler.ts`) — emite `package main`, boilerplate de `net/http` quando importado, `struct`→`type ... struct`, `impl`→métodos com ponteiro receiver, `trait`→`interface`, `scope`/`spawn`→`sync.WaitGroup`+`go func()`, `channel.send`/`.recv()`→operadores nativos `<-` do Go.
- **CLI unificada** (`src/cli.ts`, binário `flex`) — `flex run <arquivo>` (interpretado) e `flex build <arquivo>` (transpila + invoca `go build`); o type checker roda **antes** dos dois caminhos, cumprindo a condição inegociável do ADR-001 (Seção 6).
- **Suíte golden-file** (`tests/`, `tests/runner.ts`) — 11 arquivos `.flex`/`.out`, com auto-geração do golden file quando ausente. É o entregável de testes da Fase 0.
- **Exemplos públicos** (`examples/`) — três `.flex` executáveis cobrindo HTTP, concorrência e traits.

### Lacunas conhecidas (o que ainda falta ou está raso)

Achados concretos desta análise, priorizados por risco:

1. **Paridade Node↔Go incompleta.** O transpiler não emite `EnumDeclaration`, `MatchStmt`, `TryExpr`, `ArrayLiteral`, `IndexExpr`, `LogicalExpr`, `UnaryExpr` nem `BooleanLiteral` — cai no `default` (`// TODO: transpile ...`) ou em `/* expr ... */`. Ou seja: **qualquer programa que use `enum`/`match`/`?`/arrays/booleanos passa no type checker mas gera Go quebrado em `flex build`.** Isso viola o espírito (embora não a letra) do ADR-001: o checker aprova, mas o codegen não sustenta. É a lacuna de maior risco — antes de modularizar a stdlib ou empacotar dependências, o caminho de produção precisa gerar Go correto para a linguagem que o checker já aceita.
2. **`Result`/`Option` ainda não são stdlib.** Hoje cada teste declara seu próprio `enum Result { Ok(...), Err(...) }`; o operador `?` funciona por **convenção de nome de variante** (`Ok`/`Some`/`Sucesso`), não por um tipo `Result<T, E>` genérico injetado automaticamente. Fecha uma promessa da Rev. 2 (Seção 4) que ainda está pendente.
3. **Isolamento por mutabilidade cobre só o `channel.send`.** O checker marca `isMoved` apenas quando uma variável `mut` é argumento de `.send(...)`; uma variável `mut` capturada diretamente por uma closure `spawn { }` sem passar por canal **não é analisada** — a data race que a Seção 1 promete impedir ainda é possível por captura direta.
4. **Conformidade de trait é rasa.** `impl Trait for Struct` hoje valida só nome do método e quantidade de parâmetros — não compara tipos de parâmetro nem tipo de retorno.
5. **Sem funções anônimas/closures como expressão.** Funções são first-class apenas quando nomeadas (`FunctionDeclaration` guardada em uma `Identifier`); não existe literal de lambda (`|a, b| { ... }`) no parser. Handlers de rota, por exemplo, só podem ser funções `func` top-level.
6. **`flex fmt`, `flex test` e `flex mod` não existem na CLI** — os testes rodam via `npm test` chamando `tests/runner.ts` diretamente, não via `flex test`.
7. **Módulos nativos são hardcoded.** `"net/http"` é reconhecido por comparação literal de string dentro do próprio `checker.ts` (linha 74) e `transpiler.ts` (linha 36); não existe nenhum mecanismo de import entre arquivos `.flex` locais. É o gap que motiva as Seções 7 e 8 abaixo.

Nada disso invalida o que foi construído — ao contrário, valida a estratégia da Rev. 2 (laboratório Node primeiro). Mas são os itens concretos que orientam a priorização das próximas fases.

---

## 1. Sistema de Mutabilidade e Gerenciamento de Memória

Para backends concorrentes, o compartilhamento de estado mutável é a maior fonte de bugs (data races). Com GC, lifetimes não são necessários para gerenciar *memória* — o problema restante é exclusivamente *data race*, e é ele que o modelo abaixo ataca, sem impor a curva de aprendizado do borrow checker do Rust.

**Decisão Arquitetural:**

- **Imutabilidade por padrão**: qualquer `let` cria um dado imutável. Mutabilidade exige a palavra-chave explícita `mut`.
- **Isolamento por mutabilidade** (regra precisa que substitui o antigo "ownership simplificado"):
  1. Dado **imutável** pode ser compartilhado livremente entre green threads, por referência — sob GC, é seguro por construção.
  2. Dado **`mut` pertence a uma única green thread**. Enviá-lo por um channel **move** a posse: usar a variável depois do `send` é **erro de compilação**. (Exige apenas análise de fluxo de "movido" — ordens de magnitude mais simples que borrows/lifetimes.)
  3. Compartilhamento mutável real fica atrás de tipos explícitos (`Mutex<T>`) — fora do escopo da v1.

  Precedente: é o modelo de *reference capabilities* do Pony reduzido a dois modos. Data-race freedom verificável, sem a curva do Rust.
- **Gerenciamento de Memória**: **GC concorrente com orçamento de pausa** compatível com p99 de serviço (sub-ms a poucos ms). O compromisso arquitetural é o orçamento de pausa; a técnica é detalhe de implementação — "generacional" deixou de ser promessa (o Go experimentou GC generacional e o abandonou; escape analysis já elimina grande parte das alocações jovens). Enquanto a FlexLang executar sobre um host (Node no laboratório, Go no alvo de produção — ver ADR-001, Seção 6), o GC vem do host, sem custo próprio de engenharia.

**Sintaxe Conceitual:**

```flexlang
struct User {
    id: Int,
    name: String
}

impl User {
    // 'mut self' indica que este método altera o estado interno.
    // O checker propaga mutabilidade por caminho: a.b.rename() exige 'a' mutável.
    func rename(mut self, new_name: String) {
        self.name = new_name;
    }
}

// Imutável por padrão
let u1 = User { id: 1, name: "Pedro" };
// u1.rename("João"); // ERRO DE COMPILAÇÃO: u1 não é mutável

// Mutabilidade explícita
let mut u2 = User { id: 2, name: "Maria" };
u2.rename("Mariana"); // OK
```

---

## 2. Modelo de Concorrência e Assincronismo

Backends modernos lidam com I/O massivo. O modelo `async/await` fragmenta o ecossistema (funções "coloridas"); o modelo de Atores é seguro, mas complexo demais para tarefas simples. Green threads resolvem o coloring — e a FlexLang nasce com as duas correções que o Go precisou improvisar depois: escopo para toda concorrência (o `context.Context` viral é o custo de não tê-la) e backpressure por padrão.

**Decisão Arquitetural:**

- **Green Threads (M:N)**: fibras leves com stacks dinâmicas, como goroutines (Go) ou processos (Erlang) — milhões delas com baixo custo de memória.
- **Concorrência estruturada**: **não existe `spawn` solto**. Toda green thread nasce dentro de um `scope { ... }`, que só retorna quando todos os filhos terminam — ou os cancela quando o deadline do escopo estoura. Deadlines propagam automaticamente para o I/O interno: timeout por request vem de graça, sem parâmetro infeccioso em cada assinatura.
- **Channels tipados e bounded por padrão**: capacidade 0 (rendezvous síncrono, como no Go). Canal ilimitado é OOM sob carga; backpressure é requisito de backend, não opção.
- **Recepção por método**: `channel.recv()`, simétrico a `channel.send()`. O operador `<-` foi descartado — é lexicalmente ambíguo (`a <- b` vs. `a < -b`) e dissonante do design método-first da linguagem.

**Sintaxe Conceitual:**

```flexlang
func merge_reports(sql: String) -> Result<Report, AppError> {
    let results = Channel.new();  // tipado; bounded (capacidade 0) por padrão

    // Nenhum spawn "solto": o escopo espera — ou cancela — seus filhos,
    // e seu deadline propaga para todo I/O interno.
    scope(deadline: Duration.ms(200)) {
        spawn {
            let mut rows = shard_a.query(sql);
            results.send(rows);
            // 'rows' foi MOVIDO no send — usá-lo aqui seria erro de compilação
        }
        spawn { results.send(shard_b.query(sql)); }

        // Deadline estourado => recv() devolve Err, que o '?' propaga
        let first = results.recv()?;
        let second = results.recv()?;
        return Ok(combine(first, second));
    }
}
```

---

## 3. I/O e Networking

Para backends de alta performance, o I/O não pode bloquear threads do sistema operacional.

**Decisão Arquitetural:**

- **Event loop non-blocking herdado do runtime host** (ADR-001): libuv no laboratório Node; netpoller (`epoll`/`kqueue`) no backend Go. Não escreveremos um event loop próprio antes da Fase 4.
- **APIs síncronas na superfície**: a stdlib expõe métodos que parecem síncronos. Em uma chamada de rede, apenas a green thread atual é suspensa e outra assume, com retomada automática quando os dados chegam.
- **Deadlines de request propagam pelo I/O**: toda API de I/O respeita o deadline do `scope` corrente (Seção 2) — timeout por request sem parâmetro extra em cada assinatura.

**Sintaxe Conceitual (stdlib nativa `net/http`):**

```flexlang
import { Server, Request, Response } from "net/http";

func handle_users(req: Request, mut res: Response) {
    // Consulta ao BD (I/O) suspende apenas esta green thread;
    // o servidor continua aceitando outras conexões.
    let users = db.query("SELECT * FROM users");
    res.json(users);
}

let server = Server.new(":8080");  // '.' também em construtores — '::' foi descartado
server.route("/users", handle_users);      // funções são valores de primeira classe
server.route("/health", |req, mut res| {   // ...e closures permitem handlers inline
    res.text("ok");
});
server.start(); // Non-blocking I/O
```

---

## 4. Sistema de Tipos e Tratamento de Erros

Exceções (`try/catch/throw`) quebram o fluxo de controle e escondem falhas. Em sistemas distribuídos, erros são esperados e devem ser tratados como valores. A fundação, porém, vem primeiro: `Result`, `match` exaustivo e `?` **pressupõem** type checker, generics e sum types — que agora são entregáveis explícitos da Fase 1.

**Decisão Arquitetural:**

- **Núcleo do sistema de tipos (Fase 1)**: type checker estático com spans (linha/coluna); **`enum` com payload (sum types)**; **generics** com representação uniforme (boxing) — monomorfização fica como otimização futura; **inferência local** ao estilo Go/Kotlin (sem Hindley-Milner global, preservando mensagens de erro claras).
- **`Result`/`Option` são stdlib, não primitivos**: `enum Result<T, E> { Ok(T), Err(E) }` — o mesmo mecanismo fica disponível para os domínios do usuário.
- **Pattern matching com exhaustiveness**: esquecer um caso é erro de compilação — é o recurso que paga a conta do sistema de tipos.
- **Operador de propagação (`?`)**: açúcar sintático simples uma vez que `Result` existe.
- **Traits (interfaces nominais)**: `impl Serializer for User` — polimorfismo para stdlib, drivers e testes (entra na Fase 2). Funções e closures são valores de primeira classe (function types).

**Sintaxe Conceitual:**

```flexlang
// Sum types do usuário — o mesmo mecanismo que define Result na stdlib:
// enum Result<T, E> { Ok(T), Err(E) }
enum PaymentStatus {
    Pending,
    Paid(Receipt),
    Failed(String),
}

func read_file(path: String) -> Result<String, IOError> {
    // ...
}

func process_config() -> Result<Config, IOError> {
    // O operador '?' extrai o valor 'Ok' ou retorna o erro 'Err' automaticamente
    let content = read_file("/etc/config.json")?;

    // match exige exaustividade: esquecer um caso é erro de compilação
    match parse_json(content) {
        Ok(config) => return Ok(config),
        Err(e) => return Err(IOError.ParseError),
    }
}
```

---

## 5. Ecossistema de Ferramental (Tooling)

Uma linguagem não sobrevive apenas de sua sintaxe. A adoção por engenheiros de backend depende de um ferramental unificado ("out of the box").

**Decisão Arquitetural:**

- **`flex` CLI Integrada**: um único binário contendo todo o ferramental. Sem necessidade de dependências externas como `npm`, `pip` ou `cmake`.

**Componentes Essenciais (Dia 0):**

1. `flex build` / `flex run`: front-end (parser + type checker) próprio; código de produção via **transpilação para Go** (ADR-001). LLVM só entra na Fase 4+, se houver motivo real.
2. `flex test`: suporte nativo a testes unitários. Qualquer função anotada com `@test` é executada.
3. `flex fmt`: formatador de código opinativo. Fim dos debates sobre tabs vs. spaces ou onde colocar chaves.
4. `flex mod`: gerenciador de dependências descentralizado (URLs git, como o Go) para garantir reprodutibilidade.

---

## 6. Alvo de Execução e Runtime (ADR-001)

**Contexto.** A escolha do alvo de compilação determina GC, scheduler, FFI e stdlib — era a maior decisão em aberto do documento. Um runtime próprio (GC + scheduler M:N + netpoller + stacks móveis) é um projeto de anos; e "M:N em todos os cores" é inalcançável no Node puro (event loop single-threaded; workers não compartilham memória).

**Decisão.** Três estágios:

1. **Laboratório (Fases 0–2)**: o tree-walker em Node segue como ambiente de iteração da *semântica*. `spawn`/channels rodam multiplexados no event loop, em um único core — entregam o modelo de programação, não a escalabilidade.
2. **Produção (Fases 2–3)**: **transpilação para Go**. Herdamos goroutines (M:N real), channels, GC concorrente de baixa pausa, netpoller `epoll`/`kqueue` e um `net/http` battle-tested — mapeamento quase 1:1 das Seções 1–3. **Condição inegociável**: o type checker da FlexLang roda completo *antes* do codegen; o usuário nunca vê um erro de Go.
3. **Nativo (Fase 4+, se houver motivo real)**: LLVM/runtime próprio apenas se surgir um requisito que o runtime Go não atenda.

**Consequências.** A semântica precisa ser especificada de forma independente de backend — a suíte golden-file (Fase 0) vira o contrato de paridade entre Node e Go. FFI e drivers de banco chegam via ecossistema Go (`database/sql`) na Fase 3. A rota "transpilar para C" fica descartada (não traria GC nem scheduler).

---

## 7. Modularização da Stdlib (Native Modules)

Hoje, suportar uma nova lib nativa exige editar três motores ao mesmo tempo: `checker.ts` (registrar os tipos expostos), `interpreter.ts` (implementar o binding em runtime) e `transpiler.ts` (emitir o boilerplate Go). É exatamente o padrão que `"net/http"` segue agora — três blocos de `if stmt.moduleName === "net/http"` espalhados pelo core (`checker.ts:74`, `transpiler.ts:36`). Nenhum colaborador externo consegue adicionar `fs`, `encoding/json` ou um driver de banco sem tocar no core dos três motores, e sem risco de quebrar o que já existe ao redor.

**Decisão Arquitetural:**

- **Interface `NativeModule`** — cada lib nativa descreve três facetas independentes, sem precisar tocar em `checker.ts`/`interpreter.ts`/`transpiler.ts`:
  1. **`typeSurface`** — os `struct`/`trait`/assinaturas de função que o `TypeChecker` deve enxergar (substitui o `structs.set("Server", ...)` manual de hoje).
  2. **`runtimeBinding`** — a classe/objeto JS que implementa o comportamento real em modo interpretado (substitui o `FlexServer`/`FlexChannel` como casos especiais fixos do interpretador).
  3. **`goCodegen`** — as linhas de `import` Go e o boilerplate a injetar, mais as regras de tradução de call sites (substitui o `if this.importedModules.has("net/http")` do transpiler).
- **`ModuleRegistry`** — um registro único, indexado pelo caminho do módulo (`"net/http"`, `"fs"`, ...), que os três motores consultam. Checker, interpretador e transpiler passam a fazer `registry.get(moduleName)` em vez de `if/else` encadeados.
- **Escopo deliberadamente contido para v1**: só módulos 1ª-parte usam essa arquitetura no começo — migrar `net/http` como implementação de referência, e adicionar `fs` como segundo módulo, só para provar que a costura realmente desacopla. **Fora de escopo por ora**: carregamento dinâmico de plugins compilados por terceiros (superfície de ataque desnecessária antes de existir um ecossistema real) e um sistema de permissões/capabilities por módulo (só faz sentido quando houver de fato módulos de terceiros rodando código do usuário).

**Sintaxe Conceitual** (não é sintaxe da FlexLang — é a arquitetura interna do compilador):

```ts
// src/modules/http.ts — como "net/http" passaria a ser descrito
export const httpModule: NativeModule = {
  path: "net/http",
  typeSurface: {
    structs: ["Server", "Request", "Response"],
    // futuramente: assinaturas de método por struct, para o checker validar argumentos
  },
  runtimeBinding: (interpreter) => ({
    Server: { new: (addr: string) => new FlexServer(addr, interpreter) },
  }),
  goCodegen: {
    imports: ["net/http", "encoding/json"],
    boilerplate: HTTP_GO_BOILERPLATE, // string extraída do transpiler.ts atual
  },
};
```

**Pré-requisito real**: a Lacuna 1 (paridade Node↔Go, ver "Estado Atual") precisa estar fechada antes de migrar módulos para essa arquitetura — não faz sentido desacoplar o codegen de um módulo cujo próprio codegen de linguagem básica (enums/match) ainda está incompleto.

---

## 8. Módulos Locais e Gerenciador de Pacotes (`flex mod`)

O pedido da comunidade — "quero importar meu próprio código em múltiplos arquivos" e, depois, "quero publicar uma lib para outros usarem" — são dois problemas de tamanhos bem diferentes. Tratamos como dois estágios sequenciais, e o segundo só começa quando o primeiro estiver sólido.

**Decisão Arquitetural:**

- **Estágio A — Resolução de módulos locais (pré-requisito).** Hoje a FlexLang só executa um único arquivo por vez (`flex run arquivo.flex`); não existe nenhuma resolução de `import` entre arquivos `.flex`. Antes de qualquer gerenciador de pacotes, `import { Foo } from "./utils"` precisa resolver, ler e type-checar o arquivo local referenciado. Sem isso, um "pacote" não tem o que empacotar.
- **Estágio B — `flex mod`, descentralizado via Git (estilo Go).** Um manifesto (`flex.toml`) declara dependências como URL de repositório + tag/commit; um lockfile (`flex.lock`) fixa exatamente o que foi resolvido, para builds reprodutíveis; um cache local por conteúdo (`~/.flex/pkg/`) evita re-clone a cada build.
- **Deliberadamente fora de escopo agora** (para não exagerar antes da hora):
  - Servidor de índice/registro central (o Go só criou o seu — `sum.db`/proxy — anos depois de módulos já funcionarem só com Git; seguimos a mesma ordem).
  - Resolvedor de SemVer com ranges (`^1.2.3`); v1 fixa commit/tag exato, sem solver de compatibilidade.
  - Autenticação para registros privados e distribuição de artefatos binários pré-compilados.

**Sintaxe Conceitual:**

```flexlang
// Estágio A: import local, hoje inexistente
import { format_currency } from "./utils/money";
```

```toml
# flex.toml — Estágio B
[package]
name = "minha-api"
version = "0.1.0"

[dependencies]
# nome = { git = "url-do-repositorio", tag = "..." }
flex-postgres = { git = "https://github.com/comunidade/flex-postgres", tag = "v0.3.0" }
```

```bash
flex mod install   # resolve flex.toml, grava flex.lock, popula ~/.flex/pkg/
```

---

## Plano de Evolução (Roadmap)

Fases 0 a 2 estão concluídas; a Fase 3 está parcialmente entregue. As Fases 4 e 5 — modularização da stdlib e gerenciador de pacotes — são a prioridade imediata seguinte: é o que destrava colaboradores externos, o pedido concreto que motivou esta revisão. Recursos de mais longo prazo (decorators, IoC, ORM, framework web) continuam fora deste roadmap — ver `README.md`, seção "Fase 6+".

### Fase 0: Consolidação do Interpretador — ✅ Concluída

- **Entregue**: expression statements e atribuição; closures léxicas corretas (`FlexFunction`); precedência completa e operadores (`- * / % ! != <= >= && ||`); spans de linha/coluna em todo token; suíte golden-file (`tests/`, 11 casos).

### Fase 1: Núcleo do Sistema de Tipos — ✅ Concluída

- **Entregue**: type checker estático de dois passes; `enum` com payload; `match` com exhaustiveness real; enforcement de `mut` em variáveis/parâmetros/alvos de atribuição; operador `?`.
- **Pendente, movido para backlog de correção** (Lacuna 2): `Result<T, E>`/`Option<T>` como stdlib genérica de verdade, substituindo a convenção de nome de variante (`Ok`/`Some`/`Sucesso`) hoje hardcoded no checker e no interpretador.

### Fase 2: O Motor Concorrente — ✅ Concluída

- **Entregue**: `scope`/`spawn` com espera estrutural (`Promise.all`) e deadline real (`Promise.race` viabilizando timeout); `Channel` com rendezvous síncrono; `trait`/`impl Trait for Struct` com validação de conformidade; fundação do transpiler Go (`sync.WaitGroup` + `go func()` para concorrência, canais viram `<-`).
- **Pendente, priorizado abaixo** (Lacuna 3): o isolamento por mutabilidade só cobre `channel.send`; captura direta de `mut` por uma closure `spawn` sem canal não é analisada.

### Fase 3: Prontidão para Backend — 🔶 Em andamento

- **Entregue**: `net/http` funcional em modo interpretado (`FlexServer` sobre o `http` do Node); CLI `flex run`/`flex build`; `flex build` já invoca `go build` de ponta a ponta.
- **Pendente — prioridade imediata** (bloqueia tudo o que depende de `flex build` funcionar de verdade): fechar a **Lacuna 1** — paridade Node↔Go para `enum`, `match`, `?`, arrays, booleanos, lógicos e unários no transpiler. Sem isso, qualquer programa idiomático (que use `Result`/`match`) passa no checker mas quebra em `flex build`.
- **Pendente — segunda prioridade**: `flex test` e `flex fmt` como subcomandos reais da CLI (hoje `flex test` não existe; `npm test` chama `tests/runner.ts` direto); drivers de banco (PostgreSQL via `database/sql`, conforme ADR-001) ficam para depois da modularização (Fase 4), já que um driver de banco é o primeiro candidato natural a "módulo nativo de terceiros".

### Fase 4 (Nova): Modularização da Stdlib

- **Foco**: interface `NativeModule` + `ModuleRegistry` (Seção 7); migrar `net/http` como implementação de referência; adicionar `fs` como segundo módulo, para provar que a costura desacopla checker/interpretador/transpiler do core.
- **Pré-requisito**: Fase 3 completa (Lacuna 1) — não vale a pena desacoplar codegen de módulo enquanto o codegen da linguagem básica ainda tem buracos.
- **Entregável**: um colaborador consegue adicionar uma lib nativa nova (ex: `encoding/json` isolado, ou um driver) implementando a interface `NativeModule`, sem editar `checker.ts`/`interpreter.ts`/`transpiler.ts`.

### Fase 5 (Nova): Módulos Locais e Gerenciador de Pacotes

- **Foco**: Estágio A — resolução de `import` entre arquivos `.flex` locais (pré-requisito real, hoje inexistente); Estágio B — `flex mod` com manifesto (`flex.toml`), lockfile (`flex.lock`) e dependências via Git, sem registro central nem solver de SemVer (Seção 8).
- **Entregável**: um projeto FlexLang pode ser dividido em múltiplos arquivos locais (Estágio A) e, depois, a comunidade consegue publicar e consumir pacotes de terceiros via `flex mod install` (Estágio B).

### Fase 6+: Visão de Longo Prazo

Decorators, Reflection/IoC em tempo de compilação, ORM/Query Builder, RLS/multi-tenancy e o framework web oficial continuam como visão pós-Fase 5 — ver `README.md` para o resumo; o detalhamento técnico entra neste documento quando a Fase 5 estiver concluída, para não antecipar decisões que dependem do sistema de módulos já estar pronto.
