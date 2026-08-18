# RFC-017 — `else if`, `break`, `continue` e Controle de Fluxo Maduro

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** nada

## 1. Motivação

O parser atual (`parser.ts:430-432`) trata `else` seguido obrigatoriamente de `{`. Isso força qualquer cadeia de condições a virar uma pirâmide aninhada:

```flexlang
// v0.2 — pirâmide obrigatória
if x == 1 {
    print("um");
} else {
    if x == 2 {
        print("dois");
    } else {
        if x == 3 {
            print("tres");
        } else {
            print("outro");
        }
    }
}
```

Além disso, não há `break` nem `continue` para laços `for` e `while`, forçando padrões artificiais com flags booleanas.

## 2. Design

### 2.1 `else if`

O parser, ao encontrar `else`, verifica se o próximo token é `if`. Se for, emite um `IfStmt` recursivo como `alternate` em vez de exigir um `BlockStmt`.

**Mudança na AST:**

```typescript
// ast.ts - IfStmt.alternate passa a aceitar IfStmt diretamente
export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  consequent: BlockStmt;
  alternate?: BlockStmt | IfStmt; // ANTES: só BlockStmt
  span?: Span;
}
```

**Resultado na superfície:**

```flexlang
if status == "active" {
    process_active(account);
} else if status == "frozen" {
    notify_compliance(account);
} else if status == "closed" {
    archive(account);
} else {
    log.error("Status desconhecido", { status: status });
}
```

### 2.2 `break` e `continue`

Dois novos tokens e nós de statement:

```typescript
// ast.ts
export interface BreakStmt {
  kind: "BreakStmt";
  span?: Span;
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  span?: Span;
}
```

**Validação no checker:** Emitir `E2032` se `break`/`continue` aparecer fora de um `ForStmt` ou `WhileStmt`.

**No Go:**  `break` → `break`, `continue` → `continue`.

**No interpretador:** Exceções de controle de fluxo `BreakException` e `ContinueException`, capturadas pelo loop pai.

### 2.3 Transpilação Go

```flexlang
if x > 100 {
    print("alto");
} else if x > 50 {
    print("medio");
} else {
    print("baixo");
}
```

→ Go:

```go
if x > 100 {
    fmt.Println("alto")
} else if x > 50 {
    fmt.Println("medio")
} else {
    fmt.Println("baixo")
}
```

## 3. Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/ast.ts` | Novos nós `BreakStmt`, `ContinueStmt`; tipo de `IfStmt.alternate` expandido |
| `src/lexer.ts` | Novos tokens `Break`, `Continue` |
| `src/parser.ts` | `parseIfStatement` aceita `else if`; novos parsers para `break`/`continue` |
| `src/checker.ts` | Validação de contexto (dentro de loop) para `break`/`continue` |
| `src/interpreter.ts` | Exceções de controle de fluxo; `else if` na avaliação de `IfStmt` |
| `src/transpiler.ts` | Emissão de `else if` no Go; emissão de `break`/`continue` |

## 4. Plano de Testes

- Golden test: `else if` com 3+ branches
- Golden test: `else if` com `else` final
- Golden test: `break` dentro de `for` e `while`
- Golden test: `continue` dentro de `for`
- Golden test: `break`/`continue` fora de loop → erro `E2032`
- Parity test: comportamento idêntico em TS e Go

## 5. Critério de Aceite

- [x] `else if` sem aninhamento funciona em interpretador e compilado
- [x] `break` e `continue` funcionam em `for` e `while`
- [x] Erros `E2032` emitidos fora de laço
- [x] Paridade 100% entre modos
