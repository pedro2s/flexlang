# FlexLang: A Nova Geração de Linguagem de Programação

Criar uma nova linguagem de programação é um projeto ambicioso e emocionante! A concepção da FlexLang nasce da análise minuciosa do que as principais linguagens de programação oferecem de melhor. O objetivo é absorver e fundir conceitos de desempenho, simplicidade, segurança e arquitetura em uma sintaxe expressiva e moderna.

> **Nota (Rev. 2 — ago/2026):** as decisões oficiais de arquitetura estão registradas em [`.docs/flexlang_architecture_roadmap.md`](.docs/flexlang_architecture_roadmap.md). Este README é a visão geral do projeto; em caso de conflito, vale o documento de arquitetura.

Aqui estão as inspirações que moldaram a visão da FlexLang:

### 1. Python & TypeScript

- **Simplicidade e Expressividade:** A sintaxe clara e a experiência de desenvolvedor do Python aliada ao poder do ecossistema e tipagem estática do TypeScript.
- **Ecossistema:** O ferramental moderno do Node.js como **laboratório de desenvolvimento** da linguagem — o interpretador atual (lexer, parser e tree-walker em TypeScript) é o ambiente de iteração rápida da semântica (ADR-001).

### 2. Go

- **Concorrência:** Green threads e _channels_ — somando, desde o dia zero, duas correções que o Go precisou improvisar depois: **concorrência estruturada** (nenhum `spawn` solto; escopos com deadline e cancelamento) e **backpressure por padrão** (channels bounded).
- **Runtime de Produção:** O Go é mais que inspiração — é o **alvo de compilação de produção** via transpilação (ADR-001). Herdamos goroutines (M:N real), GC concorrente de baixa pausa e netpoller `epoll`/`kqueue` battle-tested, com o type checker da FlexLang rodando completo antes do codegen.

### 3. Rust

- **Ergonomia de Segurança, sem o Borrow Checker:** Imutabilidade por padrão com `mut` explícito, separação `struct`/`impl`, `Result`/`Option` com `match` exaustivo, e posse **movida** no envio entre threads (isolamento por mutabilidade). A memória fica a cargo de um **GC concorrente com orçamento de pausa** — a rota "segurança de memória sem GC, via borrow checker" foi formalmente descartada na Rev. 2 do roadmap: com GC, lifetimes só seriam necessários para data races, e o isolamento por mutabilidade resolve isso com uma fração da complexidade.

### 4. Java & Kotlin

- **Robustez Corporativa e Arquitetura:** Tipagem forte e foco em design orientado a domínio (DDD). A Injeção de Dependências entra como visão de longo prazo (pós-Fase 3) — porém **em tempo de compilação** (decorators alimentando codegen, estilo Dagger), e não via reflexão em runtime, que brigaria com a compilação AOT do ADR-001.

---

## A Proposta da FlexLang

**Nome: FlexLang**

**Objetivos Fundamentais:**

- **Sintaxe Simples e Legível:** Curva de aprendizado rápida, com tipagem estática e inferência local inteligente.
- **Alta Escalabilidade (I/O e Concorrência):** Green threads (M:N) com concorrência estruturada, channels tipados e bounded, e deadlines que propagam automaticamente pelo I/O non-blocking.
- **Erros como Valores:** `Result`/`Option` na stdlib, `match` com exaustividade verificada e operador `?` — sem exceções cegas.
- **Engenharia de Software Nativa:** Metaprogramação em tempo de compilação (decorators → codegen) para arquiteturas limpas (Arquitetura Hexagonal/Ports and Adapters) — visão pós-Fase 3.
- **Desenvolvimento Web e de APIs:** Foco na construção de APIs robustas com isolamento de domínio e conectividade impecável com bancos relacionais (PostgreSQL — inicialmente via interop com o ecossistema Go, `database/sql`).

### Exemplo de Sintaxe (Visão)

```flexlang
// Tipagem estática com inferência local
let max_connections = 100;
let host: String = "localhost";

// Dados e comportamento separados: struct + impl, com 'mut' explícito
struct User {
    id: Int,
    name: String,
}

impl User {
    // Só métodos 'mut self' podem alterar estado — e só via binding mutável
    func rename(mut self, new_name: String) {
        self.name = new_name;
    }
}

// Erros como valores: Result, match exaustivo e propagação com '?'
func load_user(id: Int) -> Result<User, DbError> {
    let user = db.find_by_id(id)?;
    return Ok(user);
}

// Concorrência estruturada: nenhuma green thread "solta" —
// o escopo espera (ou cancela) seus filhos e o deadline propaga pelo I/O
scope(deadline: Duration.ms(200)) {
    spawn { emails.send(build_welcome(user)); }
    spawn { metrics.send(Event.UserCreated); }
}
```

---

## Roadmap de Engenharia

A construção de uma linguagem exige que cada camada seja uma fundação sólida para a próxima — não se constrói um framework web sem antes ter sistema de tipos, runtime concorrente e stdlib maduros. O plano detalhado (decisões, sintaxe conceitual e entregáveis) vive em [`.docs/flexlang_architecture_roadmap.md`](.docs/flexlang_architecture_roadmap.md); o resumo:

**Estratégia de execução (ADR-001):** o core atual (lexer, parser, interpretador) é construído em **TypeScript/Node** como laboratório de semântica; a produção vem por **transpilação para Go** (herdando GC, scheduler M:N e netpoller); LLVM/runtime próprio só na Fase 4+, se um requisito real exigir.

### Fases 0–3 (documento de arquitetura)

- **Fase 0 — Consolidação do Interpretador (foco atual):** _expression statements_ e atribuição; closures capturando o ambiente de definição; precedência completa e operadores faltantes; spans (linha/coluna) nos diagnósticos; suíte golden-file.
- **Fase 1 — Núcleo do Sistema de Tipos:** type checker estático, `enum` com payload, generics, inferência local, enforcement de `mut`, `match` com exaustividade; `Result`/`Option` na stdlib e açúcar `?`.
- **Fase 2 — O Motor Concorrente:** `spawn` + channels bounded, `scope` com deadline/cancelamento, isolamento por mutabilidade (move no send), traits; início do transpiler Go.
- **Fase 3 — Prontidão para Backend:** stdlib de rede (`net/http`, `net/tcp`) sobre o netpoller do Go, deadlines em todas as APIs de I/O, drivers de banco via `database/sql` (PostgreSQL) e CLI `flex` completa (`build`, `run`, `test`, `fmt`, `mod`).

O sistema de módulos (imports/exports) evolui junto com a stdlib ao longo das Fases 2–3.

### Fase 4+ — Visão de Longo Prazo

- **Decorators e Metaprogramação:** suporte na gramática para anotações (`@Injectable()`, `@Controller()`), processadas **em tempo de compilação** (codegen), preservando a compilação AOT.
- **IoC Container Nativo:** injeção de dependências gerada pelo compilador, garantindo desacoplamento das camadas sem custo de runtime.
- **Persistência e Isolamento de Dados:** ORM e query builder sobre as structs e decorators; drivers nativos e padrões avançados como Row-Level Security (RLS) e multi-tenancy na camada de persistência.
- **O Framework Oficial:** roteamento e middlewares baseados em decorators, validação de payloads pelo type checker e CLIs que encorajam Arquitetura Hexagonal desde a criação do projeto.
- **Runtime Nativo (se necessário):** LLVM/runtime próprio, apenas se surgir um requisito que o runtime Go não atenda.

---

## Contribua!

A **FlexLang** está no começo de uma jornada extraordinária. Pesquisas detalhadas, RFCs de sintaxe e implementações no AST são sempre bem-vindas — o documento de arquitetura em [`.docs/`](.docs/flexlang_architecture_roadmap.md) é o melhor ponto de partida. Se você tiver alguma ideia ou funcionalidade arquitetural inovadora, sinta-se à vontade para abrir uma issue!
