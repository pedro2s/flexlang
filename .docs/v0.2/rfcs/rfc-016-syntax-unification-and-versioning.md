# RFC-016: Unificação de Sintaxe de Blocos e Versionamento no `flex.toml`

> **Status:** Implementado · **Prioridade:** P1 — qualidade de vida · **Depende de:** nada
> **Toca:** `src/lexer.ts`, `src/parser.ts`, `src/transpiler.ts`, `src/cli.ts`, todos os `*.flex` de testes/exemplos, e `flex.toml`

## Resumo

A FlexLang hoje usa três padrões distintos para introduzir blocos de código em construções com parâmetros:

| Construção | Sintaxe Atual | Operador |
|---|---|---|
| `func` (retorno) | `func soma(a: Int) -> Int { ... }` | `->` (arrow) |
| `match` (braço) | `Result.Ok(v) => { ... }` | `=>` (fat arrow) |
| Lambda | `\|x: Int\| { ... }` | nenhum — entra direto no bloco |

São três convenções para resolver o mesmo problema conceitual ("dado um padrão ou lista de parâmetros, execute este bloco"). Isso contradiz o princípio fundador da FlexLang de **simplicidade no aprendizado e curva de entrada mínima**.

Adicionalmente, esta RFC introduz o campo `flex_version` no `flex.toml` para rastrear a versão do compilador e permitir que breaking changes sejam gerenciados explicitamente durante a estabilização pré-1.0.

---

## Parte 1: Unificação de Sintaxe de Blocos

### 1.1 Análise do Estado Atual

**`func` com `->`:**
O operador `->` tem um papel semântico claro — ele *não* introduz um bloco, ele declara o **tipo de retorno**. A seta separa a assinatura dos parâmetros do tipo de retorno. O bloco `{ ... }` que vem depois é o corpo da função. Essa semântica é idêntica à do Rust (`fn foo() -> i32 { ... }`) e Go implicitamente (`func foo() int { ... }`).

```flex
// -> separa parâmetros do tipo de retorno, NÃO introduz um bloco
func soma(a: Int, b: Int) -> Int {
    return a + b;
}

// Sem retorno, não há -> nenhum — o bloco vem direto
func greet(name: String) {
    print("Ola ${name}");
}
```

**`match` com `=>`:**
O operador `=>` no braço de match serve *exclusivamente* como separador entre o padrão e o corpo do braço. Ele é redundante porque o padrão (ex: `Result.Ok(v)`) já termina naturalmente antes do `{`.

```flex
// => é ruído visual — o parser já sabe que o padrão terminou
match res {
    Result.Ok(v) => {
        print(v);
    },
    Result.Err(e) => {
        print(e);
    }
}
```

**Lambda sem operador:**
As lambdas já demonstram que nenhum separador é necessário — os pipes delimitam os parâmetros e o bloco vem imediatamente:

```flex
let greet = |name: String| {
    print("ola ${name}");
};
```

### 1.2 Comparação com Outras Linguagens

| Linguagem | `match`/`switch` | `func`/`fn` | Notas |
|---|---|---|---|
| **Rust** | `=> expressão` (sem `{}` obrigatório) | `-> Tipo { ... }` | `=>` justificado porque braço pode ser expressão *ou* bloco |
| **Go** | `case X:` (fallthrough model) | `func() int { ... }` | modelo de switch/case, sem pattern matching |
| **Kotlin** | `-> expressão` | `fun(): Int { ... }` | `->` no when, `: Tipo` na assinatura |
| **Swift** | `case .x:` | `func() -> Int { ... }` | model case/switch |

A FlexLang tem `{}` **obrigatório** em braços de match — não existe a ambiguidade que justifica o `=>` em Rust (onde o braço pode ser uma expressão inline). Portanto, o `=>` é pura cerimônia.

### 1.3 Opções Avaliadas

#### Opção A: Eliminar `=>` do match — braços entram direto no bloco ✅ **(Recomendada)**

```flex
match res {
    Result.Ok(v) {
        print(v);
    },
    Result.Err(e) {
        print(e);
    }
}
```

**Prós:**
- Alinha match com lambdas: parâmetros/padrão → bloco, sem operador intermediário
- Menos um símbolo para aprender
- O `->` de `func` mantém seu papel claro e separado (declaração de tipo de retorno)
- Mínima mudança no parser (remover um `consume(FatArrow)`)

**Contras:**
- Breaking change em todos os arquivos `.flex` existentes
- Perda de familiaridade para quem vem de Rust

#### Opção B: Substituir `=>` por `->` no match

```flex
match res {
    Result.Ok(v) -> {
        print(v);
    },
}
```

**Prós:**
- Um único operador (`->`) para todas as construções

**Contras:**
- Confusão semântica: `->` em `func` significa "tipo de retorno", mas em `match` significaria "executa este bloco" — são coisas fundamentalmente diferentes
- Ambiguidade potencial no parser se match algum dia retornar tipo

#### Opção C: Manter `=>` mas adotar `=>` em lambdas também

```flex
let greet = |name: String| => {
    print("ola ${name}");
};
```

**Contras:**
- Adiciona cerimônia à sintaxe mais limpa que existe hoje
- Vai na direção oposta ao objetivo de simplicidade

#### Opção D: Status quo (não fazer nada)

**Contras:**
- Mantém a inconsistência que é confusa para iniciantes

### 1.4 Decisão

**Opção A: Eliminar `=>` dos braços de match.**

Raciocínio:
1. O `->` de `func` **não é um operador de introdução de bloco** — é uma anotação de tipo de retorno. Ele deve permanecer como está.
2. O `=>` de `match` **é redundante** dado que braços sempre terminam com `{ ... }`. Eliminá-lo alinha a sintaxe com lambdas.
3. O resultado é que a FlexLang passa a ter exatamente **uma regra**: parâmetros/padrão → `{bloco}`, direto. O `->` só aparece quando há tipo de retorno para declarar.

### 1.5 Sintaxe Resultante

```flex
// func: -> permanece (é declaração de tipo de retorno, não introdução de bloco)
func soma(a: Int, b: Int) -> Int {
    return a + b;
}

// match: sem operador — padrão → bloco
match res {
    Result.Ok(v) {
        print(v);
    },
    Result.Err(e) {
        print(e);
    }
}

// lambda: sem operador — parâmetros → bloco (inalterado)
let f = |x: Int| {
    print(x);
};
```

### 1.6 Mudanças Necessárias

#### `src/lexer.ts`
- Manter `FatArrow` no lexer temporariamente (para emitir erro diagnóstico amigável se alguém usar a sintaxe antiga).

#### `src/parser.ts`
- `parseMatchStmt()`: Remover `this.consume(TokenType.FatArrow)`. Opcionalmente, se o token atual for `=>`, emitir um `FlexError` com `help: "a sintaxe de match mudou na v0.2 — remova o '=>'"`.

#### `src/transpiler.ts`
- Nenhuma mudança — o transpiler trabalha com a AST, não com tokens.

#### Testes e Exemplos
- Atualizar todos os arquivos `.flex` em `tests/`, `tests/fixtures/` e `examples/` removendo `=>` dos braços de match.
- Atualizar os arquivos `.out` golden dos testes negativos que incluem trechos de match na saída formatada.

---

## Parte 2: Versionamento no `flex.toml`

### 2.1 Motivação

A FlexLang está em fase pré-1.0 e acumulando breaking changes entre versões (como esta própria RFC). Para que projetos possam ser compilados reprodutivelmente e para que o compilador possa emitir avisos ou erros ao encontrar código escrito para uma versão incompatível, o `flex.toml` deve registrar a versão da linguagem.

### 2.2 Especificação

Adicionar o campo `flex_version` ao `flex.toml`:

```toml
[package]
name = "meu-projeto"
version = "0.1.0"
entry = "src/main.flex"
flex_version = "0.2.0"
```

- **`flex_version`**: Versão mínima do compilador FlexLang necessária para compilar o projeto. Segue semver (`MAJOR.MINOR.PATCH`).
- **Comportamento do CLI**:
  - Se `flex_version` estiver presente e for maior que a versão do compilador atual, emitir erro: `"este projeto requer FlexLang >= X.Y.Z, mas você tem A.B.C"`.
  - Se `flex_version` estiver ausente, emitir aviso gentil sugerindo adicioná-lo.
- **`flex init`**: O template gerado pelo `flex init` deve incluir `flex_version` com a versão atual do compilador.

---

## Plano de Verificação

### Testes Automatizados
- `npm test`: Todos os 35 golden tests devem passar com a nova sintaxe (sem `=>`).
- `npm run test:parity`: 35/35 no parity gate.
- `npm run test:http`: 32/32 testes HTTP.
- Teste dedicado: Parser rejeita `=>` com diagnóstico amigável apontando a migração.

### Verificação Manual
- Conferir que `flex init meu-projeto` gera `flex.toml` com `flex_version`.
- Conferir que `flex run` com `flex_version` futura emite erro claro.
