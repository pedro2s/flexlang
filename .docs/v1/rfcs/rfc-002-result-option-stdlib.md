# RFC-002: `Result<T, E>` e `Option<T>` como Stdlib Real

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** nada (pode andar em paralelo à RFC-001)
> **Bloqueia:** RFC-001 (item 3, expansão do `?`), RFC-004, RFC-005 (toda API de erro depende disto)

## Resumo

Hoje `Result` e `Option` não existem como tipos da linguagem — cada arquivo de teste declara seu próprio `enum Result { Ok(...), Err(...) }` (ver `tests/06_propagation.flex`), e o operador `?` decide qual variante é "a de sucesso" **por nome** (`"Ok"`, `"Some"`, `"Sucesso"` — hardcoded em `checker.ts:518` e `interpreter.ts:513`). Isso funciona por acaso, não por design: um enum do usuário chamado `MeuTipo { Ok(Int), Falha(String) }` colide com a heurística sem ser realmente um `Result`. Esta RFC promove `Result<T, E>` e `Option<T>` a tipos genéricos injetados automaticamente em todo programa FlexLang.

## Motivação

- Toda API HTTP de produção (RFC-004) e todo driver de banco (RFC-005) devolve `Result<T, ApiError>` ou similar — se o tipo não é padronizado, cada módulo nativo reinventa sua própria convenção de erro, e o `?` não consegue atravessar módulos de forma confiável.
- A heurística de nome de variante é uma bomba-relógio de UX: um erro de digitação (`Ok` vs `OK`) ou um enum de domínio legítimo chamado `Ok`/`Err` por coincidência quebra o `?` silenciosamente ou com uma mensagem confusa.
- É pré-requisito direto do item 3 da RFC-001 (o `?` precisa saber, em tempo de transpilação, que variante é qual — sem heurística).

## Não-objetivos

- Não introduz generics arbitrários de usuário (`struct Box<T>`) — só os dois tipos genéricos embutidos (`Result`, `Option`), que já são casos especiais no checker hoje (`checker.ts:14-22`, `FlexType` já modela `genericArgs`).
- Não adiciona combinadores funcionais (`.map()`, `.and_then()`, etc.) — isso é conveniência de stdlib, não uma mudança de linguagem, e pode vir depois da v1.0 sem quebrar nada.

## Design Detalhado

### 1. Tipos embutidos, não declarados pelo usuário

`Result<T, E>` e `Option<T>` deixam de precisar de uma declaração `enum` explícita no arquivo do usuário. O `TypeChecker` os registra automaticamente no `Pass 1` (`checker.ts:63-88`), do mesmo jeito que hoje já injeta `Server`/`Request`/`Response` quando vê `import "net/http"` (`checker.ts:74-77`) — mas incondicionalmente, para todo programa:

```ts
// checker.ts — Pass 1, incondicional (não depende de import)
this.enums.set("Result", {
  kind: "EnumDeclaration", name: "Result",
  variants: [
    { name: "Ok", payload: [{ kind: "NamedTypeNode", name: "T" }] },
    { name: "Err", payload: [{ kind: "NamedTypeNode", name: "E" }] },
  ],
});
this.enums.set("Option", {
  kind: "EnumDeclaration", name: "Option",
  variants: [
    { name: "Some", payload: [{ kind: "NamedTypeNode", name: "T" }] },
    { name: "None" },
  ],
});
```

Os nomes de variante ficam **fixos**: `Ok`/`Err` para `Result`, `Some`/`None` para `Option`. Não há mais "Sucesso" como sinônimo aceito — era um artefato dos testes em português, não uma decisão de design; times que preferem nomes em português continuam podendo criar seus próprios enums de domínio, só não chamam mais `Result`/`Option`.

### 2. `T`/`E` como parâmetros de tipo reais

O parser já entende `GenericTypeNode` (`ast.ts:126-130`, usado em anotações como `Result<Int, String>` — ver `parseTypeAnnotation`, `parser.ts:466-490`). O que falta é o `TypeChecker` **substituir** `T`/`E` pelos `genericArgs` concretos ao resolver `payloadTypes` dentro de `MatchStmt`/`CallExpr` (hoje `resolveTypeNode` em `checker.ts:533-552` não faz substituição de parâmetro de tipo — só resolve nomes concretos). Este é o único ponto de complexidade nova real desta RFC: um `resolveTypeNode` com um mapa de substituição `{T: FlexType, E: FlexType}` no escopo de checagem de uma expressão `Result<Int, String>`.

### 3. `?` deixa de usar heurística de nome

`checker.ts:518` e `interpreter.ts:513` trocam a busca por `v.name === "Ok" || v.name === "Some" || v.name === "Sucesso"` por uma checagem estrutural: `tryType.name === "Result" || tryType.name === "Option"`, e a variante de sucesso é sempre a primeira declarada (`variants[0]`) — sem ambiguidade, porque agora `Result`/`Option` são os únicos dois enums com essa semântica especial reconhecida pela linguagem.

### 4. Sintaxe de uso (sem mudança para quem já usa `?`)

```flexlang
// Não precisa mais declarar 'enum Result' — já existe.
func divide(a: Int, b: Int) -> Result<Int, String> {
    if b == 0 {
        return Result.Err("Divisão por zero!");
    }
    return Result.Ok(a / b);
}

func find_user(id: Int) -> Option<User> {
    if id == 0 { return Option.None; }
    return Option.Some(User { id: id, name: "Ana" });
}

func handler() -> Result<Int, String> {
    let x = divide(10, 2)?; // como antes — sintaxe do usuário não muda
    return Result.Ok(x);
}
```

### 5. Transpilação para Go

Segue exatamente o padrão definido na RFC-001 (item 1: interface marcadora + struct por variante), com uma otimização direta pela previsibilidade dos nomes: como `Ok`/`Err`/`Some`/`None` são fixos, o transpiler pode usar os tipos genéricos nativos do Go 1.18+ em vez de `interface{}`:

```go
type Result[T any, E any] struct {
    ok    T
    err   E
    isOk  bool
}
func Ok[T any, E any](v T) Result[T, E]  { return Result[T, E]{ok: v, isOk: true} }
func Err[T any, E any](e E) Result[T, E] { return Result[T, E]{err: e, isOk: false} }
```

Isso é uma exceção deliberada ao padrão geral "enum → interface + type-switch" da RFC-001 — só para `Result`/`Option`, porque são os dois únicos casos onde vale o custo de um tratamento especial no transpiler (todo o resto de erro/ausência de valor da stdlib e do código do usuário passa por eles).

## Plano de Testes

1. Reescrever `tests/06_propagation.flex` para **não** declarar seu próprio `enum Result` — usar o embutido — e confirmar que o golden-file (`.out`) não muda.
2. Teste negativo: um enum de usuário chamado `Result` (redeclaração) deve falhar no checker com uma mensagem clara ("Result é um tipo embutido, não pode ser redeclarado"), em vez de silenciosamente sombrear o embutido.
3. Teste de `Option`: cadeia `find_user(id)?` propagando `None` como erro implícito de "não encontrado".
4. Estender o parity gate da RFC-001 para incluir esses casos (o `Result`/`Option` embutido é o teste de fumaça mais importante do transpiler, já que é o tipo mais usado em qualquer API real).

## Critério de Aceite

- [x] Nenhum `.flex` de teste ou exemplo declara seu próprio `enum Result`/`Option`. (A única exceção é `tests/18_result_redeclarado.flex`, que existe justamente para provar que a redeclaração é recusada.)
- [x] `?` funciona por checagem estrutural de tipo, sem qualquer `if v.name === "Ok" || ...` no código-fonte do checker/interpretador.
- [x] `Result<T, E>` e `Option<T>` passam no parity gate — **mas não transpilam para Go genérico**; ver "Desvio do item 5" abaixo.

## Estado da Implementação

Entregue em `src/stdlib.ts` (novo — definição única dos embutidos, consumida por checker, interpretador e transpiler), `src/checker.ts`, `src/interpreter.ts` e `src/transpiler.ts`.

Os itens 1 a 4 saíram como desenhados. `Result<T, E>` e `Option<T>` são registrados incondicionalmente, redeclarar qualquer um deles (como `enum`, `struct` ou `trait`) falha com mensagem específica, `resolveTypeNode` ganhou um mapa de substituição de parâmetros de tipo, e o `?` passou a ser estrutural nos três componentes — a heurística `"Ok"/"Some"/"Sucesso"` não existe mais em lugar nenhum. Os goldens de `tests/06_propagation.flex` e `tests/13_try_chain.flex` não mudaram ao trocar o enum próprio pelo embutido, que era o teste de fumaça pedido no plano.

### Desvio do item 5: apagamento de tipo, não generics do Go

O item 5 propõe `Result[T, E]` usando generics nativos do Go. **Não foi o caminho tomado**: o transpiler emite uma única definição por embutido, com o payload dos parâmetros de tipo apagado para `any`, e insere a asserção do tipo concreto no ponto de extração (binder de `match` e valor do `?`), a partir da instanciação que o checker resolveu:

```go
type Result interface{ isResult() }
type Result_Ok struct{ Field0 any }
// ...
case Result_Ok:
    v := __m4.Field0.(int)   // instanciação Result<Int, String>, resolvida pelo checker
```

O motivo é o `?`, que é a razão de o tipo existir. Com `Result[T, E]`, `Ok[T, E](v)` não tem como inferir `E` do argumento — toda construção precisaria da instanciação completa no site, o que exige inferência bidirecional que o checker não faz — e, pior, propagar um `Err` de `Result<Int, String>` de dentro de uma função que devolve `Result<Bool, String>` deixaria de compilar em Go, embora seja exatamente o uso normal do `?`. O apagamento mantém uma única representação para todas as instanciações e um único padrão de codegen (o da RFC-001), ao custo de a checagem sair do compilador Go e voltar para o checker — ver abaixo.

### Checagens que passaram a ser responsabilidade do checker

O apagamento troca erro de compilação do Go por asserção em tempo de execução, então duas validações que os generics do Go dariam de graça foram implementadas no checker (com testes negativos dedicados):

- **Instanciação no retorno** (`tests/20_result_instanciacao.flex`): na construção, `Result.Ok(x)` aceita qualquer `x`, porque `T` é livre; é no `return` que o `Result<Int, String>` declarado cobra o tipo. Sem isso, `return Result.Ok("texto")` numa função `-> Result<Int, String>` rodaria interpretado e daria panic no binário Go.
- **Erro propagado pelo `?`** (`tests/21_try_erro_incompativel.flex`): como o erro é propagado como está, os parâmetros de tipo que ele carrega precisam caber no retorno de quem propaga. A checagem é feita só sobre os parâmetros que aparecem nas variantes não-sucesso — por isso propagar `Option<User>` dentro de uma função `-> Option<String>` continua válido: `None` não carrega nada.

### Limitação conhecida

A instanciação só é verificada onde há um tipo declarado (retorno de função, anotação de variável, parâmetro). Um `let r = Result.Ok(5);` solto infere `Result<Int, Any>`, e o `Any` vira `any` no Go sem asserção — o valor imprime igual nos dois modos, mas não serve para aritmética no modo compilado. Anotar o tipo resolve; fechar o caso geral exige inferência bidirecional, que continua fora de escopo.

## Riscos e Alternativas Consideradas

- **Alternativa descartada**: manter `Result`/`Option` como enums "normais" que o usuário declara importando de uma stdlib (`import { Result } from "core/result"`). Rejeitada para v1.0 por adicionar uma dependência de import antes de existir qualquer sistema de módulos (RFC-006) — mais simples embutir incondicionalmente agora, e revisitar como import explícito só se um dia a linguagem quiser stdlib totalmente "opt-in".
- **Risco de breaking change**: qualquer `.flex` existente que declare `enum Result`/`Option` manualmente para de compilar (colisão de nome). Mitigação: mensagem de erro específica (ver testes) em vez de um `TypeError` genérico de redeclaração.
