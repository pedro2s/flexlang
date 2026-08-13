# RFC-004: `net/http` v1 — Superfície de Produção

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-002, RFC-003
> **Depende também de:** RFC-008 (hooks de shutdown/logging entram na mesma superfície de `Server`)

## Resumo

`net/http` hoje (`interpreter.ts` classe `FlexServer`, `transpiler.ts` boilerplate Go) resolve o "hello world": rotas exatas por string, sem parâmetros de caminho, sem parsing de corpo, sem resposta de erro estruturada, sem timeout, sem shutdown gracioso. Esta RFC define a superfície mínima necessária para o caso de uso de referência do PRD (uma API CRUD real) — nem mais, nem menos.

## Motivação

Testado diretamente: `tests/11_imports.flex` só confirma que `Server.new` é reconhecido; `FlexServer.mux` (`interpreter.ts:82`) é um `Map<string, handler>` de correspondência **exata** de path — `/users/1` e `/users/2` exigiriam duas rotas registradas manualmente. Isso não sustenta uma API REST real.

## Não-objetivos

- **Não** inclui um sistema de middleware genérico e componível (`server.use(mw)`) — a v1.0 resolve autenticação/logging via hooks pontuais (RFC-008) e validação inline no handler. Middleware componível é um bom candidato de v1.1, quando houver mais de um caso de uso real pressionando o design.
- **Não** inclui WebSockets (fora de escopo do PRD, Seção 4).
- **Não** inclui um roteador com regex arbitrário — só segmentos nomeados (`:id`), que cobrem o caso de uso de referência.

## Design Detalhado

### 1. Roteamento com parâmetros de caminho

```flexlang
server.route("/users/:id", get_user);   // ':id' captura um segmento
server.route("/users", list_users);
```

`FlexServer.mux` deixa de ser um `Map<string, handler>` exato e passa a ser uma lista de rotas compiladas (`{ segments: string[], handler }`, onde um segmento começando com `:` é um wildcard nomeado), com correspondência O(rotas) por request — suficiente para o volume de rotas de uma API real, sem precisar de um trie no v1.0.

### 2. `Request`: acesso tipado a parâmetros, query e corpo

```flexlang
func get_user(req: Request, mut res: Response) {
    let id = req.param_int("id")?;       // Result<Int, ApiError> — RFC-002
    let page = req.query_int("page");    // Option<Int> — ausência não é erro
    let body: CreateUserInput = req.json()?; // desserialização tipada do corpo
}
```

- `req.param(name)` / `req.param_int(name)` → `String` / `Result<Int, ApiError>` (erro se o segmento não existe ou não parseia como Int).
- `req.query(name)` / `req.query_int(name)` → `Option<String>` / `Option<Int>` (query params são opcionais por natureza).
- `req.json<T>()` → `Result<T, ApiError>`, desserializando o corpo contra o `struct` alvo. Isso depende de o `TypeChecker` conhecer o tipo esperado (inferido do tipo declarado da variável, como já acontece em `VarDeclaration` — `checker.ts:94-110`).

### 3. `Response`: respostas estruturadas, incluindo erro

```flexlang
res.json(user);                 // 200, Content-Type: application/json
res.status(201).json(user);     // código de status explícito
res.error(404, "user not found"); // {"error": "user not found"} com o status dado
```

`res.error(status, msg)` existe **especificamente** para que toda API FlexLang tenha um formato de erro consistente por padrão, em vez de cada time inventar o próprio shape de erro JSON — decisão de opinião deliberada da stdlib, não uma obrigação técnica.

### 4. Timeouts e limites (ligação direta com RFC-009 — segurança)

`Server.new(":8080")` ganha uma assinatura estendida opcional:

```flexlang
let server = Server.new(":8080", ServerConfig {
    read_timeout: Duration.seconds(5),
    max_body_size: 1_000_000, // 1 MB
});
```

Valores padrão sensatos (timeout de 5s, corpo máximo de 1 MB) se `ServerConfig` não for passado — "seguro por padrão" é requisito do PRD (RFC-009), não opcional.

### 5. Transpilação para Go

O boilerplate hoje hardcoded em `transpiler.ts:36-54` migra para o `goCodegen.boilerplate` do módulo `net/http` (RFC-003). O roteamento com parâmetros nomeados mapeia diretamente para `http.ServeMux` do Go 1.22+, que já suporta padrões `"/users/{id}"` nativamente — **sem** precisar de uma lib de roteamento externa em Go, mantendo a promessa do ADR-001 de dependências mínimas.

## Plano de Testes

1. Teste de integração real (não só golden-file): subir um `FlexServer` de teste, disparar requisições HTTP de verdade (via `fetch`/`curl` em um script de teste) contra rotas com parâmetro, query e corpo JSON, validar status e corpo da resposta.
2. Teste de erro: corpo JSON malformado deve devolver `res.error(400, ...)` automaticamente antes mesmo do handler rodar (falha de `req.json()` tratada pelo `?` do handler, ou por um wrapper padrão — a definir na implementação).
3. Teste de limite: corpo maior que `max_body_size` é rejeitado com 413, sem estourar memória do processo.
4. Parity gate (RFC-001): o mesmo cenário de teste roda contra `flex run` e contra o binário `flex build`, comparando respostas HTTP.

## Critério de Aceite

- [ ] Rotas com parâmetro nomeado (`:id`) funcionam em modo interpretado e compilado.
- [ ] `req.json()`, `req.param_int()`, `req.query()` implementados e cobertos por teste de integração.
- [ ] `res.error()` produz um formato de erro JSON consistente.
- [ ] Timeout e limite de corpo têm valores padrão sem configuração explícita.

## Riscos e Alternativas Consideradas

- **Alternativa descartada**: middleware componível completo (`server.use()`) já na v1.0. Rejeitada por Seção "Não-objetivos" — o caso de uso de referência do PRD não exige mais que um hook de shutdown (RFC-008) e validação inline; adicionar um sistema de middleware sem um segundo caso de uso real para validar o design é over-engineering.
- **Risco**: decisão de formato de erro (`res.error`) é opinativa — pode não agradar todo mundo. Aceito deliberadamente: consistência de stdlib vale mais que flexibilidade não pedida, na v1.0.
