# FlexLang: Roadmap Arquitetural para Backends Escaláveis

> **Rev. 2 — agosto/2026.** Revisado após debate arquitetural. Este documento é a fonte de verdade da arquitetura da FlexLang; onde houver conflito com o README (em especial a ideia de "segurança de memória sem GC tradicional, via borrow checker"), vale o que está aqui.

Avaliada a estrutura atual da **FlexLang** — interpretador tree-walking em TypeScript com `struct`, `impl`, funções, controle de fluxo e escopos léxicos — a separação clara entre dados e comportamento já nos coloca em excelente posição para uma linguagem previsível e sustentável. Este documento registra as decisões arquiteturais e o plano de evolução (Fases 0 a 3) rumo ao objetivo: uma linguagem robusta, performática e escalável para backends.

Em uma frase, o alvo é **"um Go com sistema de tipos melhor"** — GC + green threads + `Result`/`match` — somando, desde o dia zero, duas lições que o ecossistema Go aprendeu tarde demais: **concorrência estruturada** e **backpressure por padrão**.

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

## Plano de Evolução (Roadmap)

### Fase 0: Consolidação do Interpretador (Imediato)

- **Foco**: eliminar os gaps estruturais do laboratório Node — *expression statements* e atribuição (`self.name = v;` e `u2.rename(...);` hoje nem parseiam); closures capturando o ambiente de **definição** (hoje o escopo é dinâmico); precedência/associatividade completas e operadores faltantes (`-`, `*`, `/`, `!=`, `<=`, `>=`, `&&`, `||`); spans (linha/coluna) em tokens, AST e diagnósticos; suíte **golden-file** (`.flex` → stdout/erro esperado).
- **Entregável**: os exemplos da Seção 1 executam no interpretador; diagnósticos apontam linha/coluna; toda feature nova nasce com teste-espec. É a fundação exigida pelo checker da Fase 1.

### Fase 1: Núcleo do Sistema de Tipos (Curto Prazo)

- **Foco**: type checker estático; `enum` com payload; generics (representação uniforme); inferência local; enforcement de `mut` — incluindo propagação por caminho de acesso (`a.b.rename()` exige `a` mutável); `match` com exhaustiveness; `Result`/`Option` na stdlib; açúcar `?`.
- **Entregável**: erros de tipo, mutabilidade e exaustividade em tempo de compilação; tratamento de erros obrigatório sem exceções cegas. (O que a antiga Fase 1 prometia, agora com a fundação explícita — sem enums + generics + checker não existe `Result` de verdade.)

### Fase 2: O Motor Concorrente (Médio Prazo)

- **Foco**: `spawn` + channels bounded; **concorrência estruturada** (`scope` com espera, cancelamento e deadline); regra de **isolamento por mutabilidade** (move no send; use-after-send é erro de compilação); **traits**; início do transpiler Go (ADR-001).
- **Entregável**: modelo concorrente completo no laboratório Node (single-core) e primeiro binário via Go com M:N real usando todos os cores da CPU.

### Fase 3: Prontidão para Backend (Longo Prazo)

- **Foco**: biblioteca padrão de rede (`net/http`, `net/tcp`) sobre o netpoller do runtime Go, com deadlines propagando por todas as APIs de I/O; drivers de banco via interop Go (`database/sql`, começando por PostgreSQL); CLI `flex` completa.
- **Entregável**: FlexLang torna-se viável para construção de APIs REST, WebSockets e microsserviços em produção.
