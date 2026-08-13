# RFC-001: Paridade Node↔Go no Transpiler

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** nada (caminho crítico, começa primeiro)
> **Bloqueia:** RFC-003, RFC-004, RFC-005 (qualquer coisa que dependa de `flex build` gerar Go correto)

## Resumo

O `TypeChecker` (`src/checker.ts`) aceita hoje toda a superfície da linguagem — `enum`, `match`, `?`, arrays, booleanos, operadores lógicos e unários. O `GoTranspiler` (`src/transpiler.ts`) não. Ao encontrar esses nós, ele emite `// TODO: transpile ${stmt.kind}` (statements) ou `/* expr ${expr.kind} */` (expressões) — Go inválido. Resultado: **qualquer programa que use `Result`/`match` (ou seja, qualquer programa FlexLang idiomático) passa em `flex run` e quebra em `flex build`.** Esta RFC fecha essa lacuna antes de qualquer outro trabalho de produção começar.

## Motivação

Verificado diretamente no código-fonte:

- `transpileStmt` (`transpiler.ts:94-240`) não tem `case` para `EnumDeclaration`, `MatchStmt` nem `TryExpr` — caem no `default` (linha 236-238).
- `transpileExpr` (`transpiler.ts:249-293`) não tem `case` para `ArrayLiteral`, `IndexExpr`, `LogicalExpr`, `UnaryExpr` nem `BooleanLiteral` — caem no `default` (linha 290-291), que retorna um comentário Go, não uma expressão válida.

O ADR-001 do roadmap arquitetural promete que "o usuário nunca vê um erro de Go" porque o checker roda antes do codegen. Isso é tecnicamente verdade (`cli.ts` chama `checker.check(ast)` antes dos dois caminhos), mas é uma falsa sensação de segurança: o checker aprovar não significa que o Go gerado compila. Esta RFC é sobre fechar esse gap real, não o gap que o ADR-001 pensava estar fechando.

## Não-objetivos

- Não é objetivo desta RFC otimizar o Go gerado (nomes idiomáticos, formatação `gofmt`-perfeita) — só que ele **compile e produza o mesmo resultado observável** que o modo interpretado.
- Não cobre generics reais (monomorfização) — `enum`/`match` com payload concreto (`Result<Int, String>`) são suficientes para o caso de uso de referência do PRD; genéricos totalmente parametrizados ficam de fora.

## Design Detalhado

### 1. `EnumDeclaration` → Go

Cada `enum` vira uma `interface` marcadora + um `struct` por variante, no padrão idiomático de sum types em Go (o mesmo usado por bibliotecas como `github.com/golang/protobuf` para `oneof`):

```flexlang
enum Result {
    Ok(Int),
    Err(String)
}
```

```go
type Result interface{ isResult() }

type Result_Ok struct{ Field0 int }
func (Result_Ok) isResult() {}

type Result_Err struct{ Field0 string }
func (Result_Err) isResult() {}

func Result_Ok_new(f0 int) Result { return Result_Ok{Field0: f0} }
func Result_Err_new(f0 string) Result { return Result_Err{Field0: f0} }
```

`Status.Sucesso("msg")` (uma `MemberExpr`+`CallExpr` sobre um enum, já reconhecido pelo checker em `checker.ts:372-394`) transpila para `Status_Sucesso_new("msg")`. Variantes sem payload (`Pendente`) viram uma struct vazia com instância singleton (`var Status_Pendente = Status_Pendente_t{}`).

### 2. `MatchStmt` → Go

`match` sobre enum vira `switch` com type-switch do Go, usando os binders como variáveis locais extraídas dos campos posicionais:

```flexlang
match s {
    Status.Sucesso(msg) => { print(msg); },
    Status.Erro(codigo, msgErro) => { print(codigo); print(msgErro); },
    Status.Pendente => { print("..."); }
}
```

```go
switch v := s.(type) {
case Status_Sucesso:
    msg := v.Field0
    fmt.Println(msg)
case Status_Erro:
    codigo, msgErro := v.Field0, v.Field1
    fmt.Println(codigo)
    fmt.Println(msgErro)
case Status_Pendente_t:
    fmt.Println("...")
}
```

A exhaustiveness já validada pelo checker (`checker.ts:262-269`) significa que o `switch` gerado **não precisa** de um `default` — se o checker aprovou, todas as variantes estão cobertas. Isso deve ser um teste de paridade explícito (ver "Plano de Testes").

### 3. `TryExpr` (`?`) → Go

Como Go não tem operador `?`, o `?` expande para um `if` de checagem de erro no fluxo em que aparece, seguindo a convenção "a variante de erro é sempre o segundo caso do type-switch, e a função envolvente sempre retorna o mesmo tipo enum":

```flexlang
func calcula() -> Result {
    let mut x = divide(10, 2)?;
    ...
}
```

```go
func calcula() Result {
    __r0 := divide(10, 2)
    var x int
    switch v := __r0.(type) {
    case Result_Ok:
        x = v.Field0
    default:
        return __r0 // propaga o Err como está
    }
    ...
}
```

Essa expansão depende de RFC-002 (`Result`/`Option` como stdlib real com nomes de variante fixos `Ok`/`Err`/`Some`/`None`) para não precisar redescobrir em tempo de transpilação qual variante é "a de sucesso" — hoje isso é feito por heurística de nome (`checker.ts:518`, `interpreter.ts:513`), o que é frágil o bastante para não virar a base do codegen Go.

### 4. Arrays, booleanos, lógicos e unários → Go

Estes são diretos, não exigem nenhuma decisão de design nova — apenas preencher os `case` que faltam:

| FlexLang (AST) | Go |
|---|---|
| `ArrayLiteral` | slice literal: `[]int{1, 2, 3}` (tipo do elemento vem do `FlexType` já resolvido pelo checker) |
| `IndexExpr` | `arr[idx]` |
| `LogicalExpr` (`&&`, `\|\|`) | `&&`, `\|\|` nativos do Go |
| `UnaryExpr` (`!`, `-`) | `!`, `-` nativos do Go |
| `BooleanLiteral` | `true`/`false` |

### Onde o tipo resolvido do checker é necessário

Hoje o transpiler não recebe a saída do `TypeChecker` — ele opera só sobre a AST bruta (`transpiler.ts:10`, `GoTranspiler.transpile(program: Stmt[])`). Para emitir `[]int{}` corretamente (e não `[]any{}`), o transpiler precisa do tipo resolvido de cada `ArrayLiteral`. **Mudança de assinatura necessária**: `TypeChecker.check()` passa a devolver (ou expor via método) um mapa `Expr → FlexType` anotado durante a checagem, e `GoTranspiler.transpile()` passa a receber esse mapa como segundo argumento. Isso é uma mudança pequena e localizada, não uma reescrita.

## Plano de Testes

1. **Parity gate (o mais importante desta RFC)**: para cada arquivo em `tests/*.flex`, rodar tanto `flex run` (interpretado) quanto `flex build` + executar o binário Go resultante, e comparar as duas saídas byte a byte. Hoje só o modo interpretado é validado pelo golden-file runner (`tests/runner.ts`) — este gate estende o runner para rodar os dois caminhos. Ver detalhamento em [`test_plan.md`](../test_plan.md).
2. Casos novos dedicados: um `.flex` por combinação (enum sem payload, enum com múltiplos campos, match aninhado, `?` em cadeia, array de structs, unário duplo `--x`).
3. Teste negativo: um `match` não-exaustivo já falha no checker (comportamento existente) — confirmar que continua falhando **antes** de chegar no transpiler.

## Critério de Aceite

- [ ] Todo `.flex` em `tests/` compila via `flex build` sem erro do `go build`.
- [ ] O parity gate roda em CI e falha se a saída interpretada divergir da saída compilada, para qualquer teste.
- [ ] Nenhum `case` de `Stmt`/`Expr` cai mais no `default` de `transpileStmt`/`transpileExpr` para a superfície de linguagem coberta pelos testes atuais.

## Riscos e Alternativas Consideradas

- **Alternativa descartada**: gerar Go usando `interface{}`/reflection para enums, em vez de type-switch estático. Rejeitada por perder a checagem de exhaustividade em tempo de compilação do próprio Go — o type-switch estático faz o compilador Go reforçar a mesma garantia que o FlexLang checker já deu.
- **Risco**: o mapeamento de `?` (item 3) assume que toda função que usa `?` retorna o mesmo tipo enum do valor testado — o checker já valida isso (`checker.ts:508-513`), então o transpiler pode confiar nessa invariante sem revalidar.
