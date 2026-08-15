# PRD — FlexLang v0.2.0

> **Status:** Draft · **Dono:** Arquitetura FlexLang · **Última revisão:** agosto/2026
> **Versão anterior:** [`.docs/v1/`](../v1/) — o conjunto que definiu a v0.1.0 publicada (a pasta se chama `v1` por ter sido escrita quando o alvo ainda era chamado "v1"; o release saiu como `0.1.0`, ver [`release_plan.md`](../v1/release_plan.md)).

## 1. Contexto

A v0.1.x provou o mais difícil: a linguagem compila para Go, roda em produção, e o pipeline de release publica sozinho. O que esta análise revelou é que **ela ainda não consegue expressar uma API REST de verdade** — e que existem três defeitos silenciosos que só aparecem quando alguém escreve código real.

Todos os achados abaixo foram verificados executando o compilador, não lendo a documentação:

### 1.1 O roteador ignora o verbo HTTP (bloqueante)

`server.route(path, handler)` casa **apenas o path** (`src/modules/http.ts:166`, `matchRoute` em `http.ts:32`). Consequência direta: `GET /users` e `POST /users` são obrigatoriamente o mesmo handler. Não existe forma de escrever um CRUD — o verbo simplesmente não faz parte da decisão de roteamento, nem no interpretador nem no Go gerado (`http.ts:417`).

### 1.2 Não existe `Float`, e a aritmética diverge entre os dois modos (crítico)

`FlexType` (`src/checker.ts`) tem `Int`, `String`, `Bool`, `Array`, `Struct`, `Enum`, `Map`, `Void`, `Any` — **não tem Float**. O lexer aceita `19.90` (`lexer.ts:34`, `/^\d+(\.\d+)?/`) e o checker o tipa como `Int`. Pior, a divisão diverge entre os dois runtimes:

```flexlang
let x = 7 / 2;
print(x);
```

| Modo | Saída |
|---|---|
| `flex run` (interpretado) | `3.5` |
| `flex build` + binário Go | `3` |

Isso **viola a promessa central do ADR-001 e da RFC-001** ("o mesmo programa produz o mesmo resultado nos dois modos"). O parity gate não detectou porque nenhum teste da suíte faz divisão não-exata — verificado com `grep` em `tests/*.flex`. E `let preco: Float = 19.90;` falha com uma mensagem enganosa (`Cannot assign value of type 'Int'`), porque `Float` não existe.

Para backend isso não é acadêmico: preço, percentual, latência, coordenada e qualquer média são Float.

### 1.3 Erros do compilador não dizem *onde*, e vazam stack trace do Node

Nenhuma mensagem de erro cita linha ou coluna. Os tokens têm `line`/`column` (`ast.ts:63-64`), mas **o parser descarta esses spans ao construir a AST** — os nós não os carregam, então o checker não tem como reportá-los. A RFC-001 listava "spans em tokens, AST e diagnósticos" como entregável da Fase 0; só a primeira metade foi feita.

Além disso, o erro chega ao usuário assim:

```
Error: TypeError: Cannot assign value of type 'Int' to variable 'preco' of type 'Float'
    at TypeChecker.checkStmt (file:///.../dist/cli.js:2165:17)
    at TypeChecker.check (file:///.../dist/cli.js:2149:14)
    ...
```

Stack trace do compilador vazando para quem escreve FlexLang. Agora que a linguagem está publicada no npm, essa é a primeira coisa que um usuário novo encontra ao errar.

### 1.4 O ciclo de desenvolvimento é manual

`flex run` executa uma vez e sai. Toda alteração exige `Ctrl+C` e re-executar — e como o servidor HTTP segura o processo, isso acontece a cada linha alterada.

### 1.5 Sem middleware, toda API repete auth em cada handler

Não existe `req.header(...)` nem qualquer forma de interceptar requisições. Autenticação, CORS e log por request teriam de ser copiados dentro de cada handler.

## 2. Objetivo da v0.2.0

> Escrever uma API REST CRUD autenticada em FlexLang deve ser natural, e o ciclo editar → ver rodando deve ser imediato.

### Caso de uso de referência (critério de aceite mestre)

```flexlang
import { Server, Request, Response } from "net/http";
import { log } from "core/log";

struct Product { id: Int, name: String, price: Float }

// Middleware tem a mesma assinatura de um handler.
// Regra única: se respondeu, a cadeia para; se não respondeu, segue (RFC-015 §3.1).
func require_auth(req: Request, mut res: Response) {
    match req.header("Authorization") {
        Option.None    => { res.error(401, "unauthorized"); },
        Option.Some(t) => { },
    }
}

func list_products(req: Request, mut res: Response)   { /* ... */ }
func create_product(req: Request, mut res: Response)  { /* ... */ }
func replace_product(req: Request, mut res: Response) { /* ... */ }
func patch_product(req: Request, mut res: Response)   { /* ... */ }
func delete_product(req: Request, mut res: Response)  { /* ... */ }

let mut server = Server.new(":8080");
server.use(require_auth);

server.get("/products", list_products);
server.post("/products", create_product);
server.put("/products/:id", replace_product);
server.patch("/products/:id", patch_product);
server.delete("/products/:id", delete_product);

server.start();
```

Rodando com `flex run --watch src/main.flex`, com `price: Float` que se comporta igual nos dois modos, e com erros de compilação que apontam linha e coluna.

## 3. Escopo (Definition of Done)

| # | Entrega | RFC | Prioridade |
|---|---|---|---|
| 1 | Roteamento por verbo (`get`/`post`/`put`/`patch`/`delete`), com `405` + header `Allow` | [RFC-011](rfcs/rfc-011-http-method-routing.md) | **P0** |
| 2 | `flex run --watch` com reload por subprocesso, e `flex run` sem argumento usando `entry` do `flex.toml` | [RFC-012](rfcs/rfc-012-flex-run-watch.md) | **P0** |
| 3 | Tipo `Float` e correção da divergência aritmética entre os dois modos | [RFC-013](rfcs/rfc-013-float-and-arithmetic-parity.md) | **P0** |
| 4 | Diagnósticos com linha/coluna, trecho do código e sem stack trace do Node | [RFC-014](rfcs/rfc-014-compiler-diagnostics.md) | **P0** |
| 5 | Middleware (`server.use`), `req.header()` e CORS | [RFC-015](rfcs/rfc-015-middleware-and-cors.md) | P1 |

P0 é bloqueante para a release. P1 sai da v0.2.0 se o prazo apertar, sem invalidar o resto.

**Ordem de execução recomendada.** RFC-013 e RFC-014 primeiro: são os que mexem em lexer/parser/AST/checker, e todo o resto herda os spans e os tipos. RFC-011 e RFC-015 tocam o mesmo arquivo (`src/modules/http.ts`) e devem ser sequenciais entre si, não paralelas. RFC-012 é independente (só CLI) e pode andar a qualquer momento.

## 4. Fora de escopo (decidido, não esquecido)

- **Roteador em trie/radix tree.** O casamento continua linear na ordem de registro. Para as ~dezenas de rotas de uma API real, isso é da ordem de microssegundos por request, irrelevante ao lado de uma query de banco. Otimizar antes de existir um benchmark que aponte o roteador como gargalo seria otimização prematura — e trie muda a semântica de precedência entre rotas ambíguas, um custo real por um ganho não medido.
- **Validação declarativa de DTO** (`@min`, `@required`). Depende de decorators, que são Fase 6+ do roadmap arquitetural. Na v0.2 a validação é código explícito no handler.
- **`flex fmt`.** Continua pendente da RFC-007; não bloqueia nenhuma das entregas acima.
- **WebSockets, `flex mod`, ORM.** Inalterados desde a v0.1.
- **Hot reload preservando estado** (trocar código sem derrubar o processo). Ver RFC-012, "Alternativas": exige teardown de recursos que o interpretador não modela, com alto risco de vazamento entre reloads, por um ganho de centenas de milissegundos.

## 5. Requisitos não-funcionais

- **Paridade acima de tudo.** Toda mudança desta release nasce com teste no parity gate. O bug 1.2 existiu justamente porque uma área inteira (aritmética) não tinha cobertura de paridade.
- **Nenhuma regressão de segurança.** Os defaults da RFC-009 (limite de corpo, timeout, mascaramento de log) continuam valendo, inclusive nos caminhos novos de middleware.
- **Reload em menos de 1s** para o projeto de referência (`flex init`), medido do salvamento do arquivo até o servidor aceitar conexão.

## 6. Breaking changes

A v0.2.0 remove `server.route(path, handler)` (substituído pelos métodos por verbo). Permitido pela política de `0.x` do [`release_plan.md`](../v1/release_plan.md) §1, e mitigado por uma mensagem de erro dedicada que aponta a substituição (RFC-011 §5) em vez de um "método não encontrado" genérico.

Mudanças de comportamento aritmético (RFC-013) podem alterar resultados de programas existentes que dependiam, sem saber, da divisão float do modo interpretado — que era exatamente o bug.

## 7. Métricas de sucesso

1. O caso de uso da §2 roda idêntico em `flex run` e no binário de `flex build`.
2. Parity gate cobrindo aritmética (`Int`/`Float`, divisão, módulo, divisão por zero) e os cinco verbos HTTP.
3. Nenhum erro de compilação chega ao usuário sem linha/coluna ou com stack trace do Node.
