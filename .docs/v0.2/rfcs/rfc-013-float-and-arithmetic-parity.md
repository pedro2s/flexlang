# RFC-013: Tipo `Float` e Paridade Aritmética

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** nada
> **Toca:** `src/lexer.ts`, `src/ast.ts`, `src/parser.ts`, `src/checker.ts`, `src/interpreter.ts`, `src/transpiler.ts`
> **Corrige:** violação da promessa de paridade do ADR-001/RFC-001

## Resumo

A FlexLang não tem tipo de ponto flutuante, aceita literais decimais tipando-os como `Int`, e **produz resultados diferentes nos dois modos de execução para a mesma expressão aritmética**. Esta RFC introduz `Float` e alinha a semântica numérica do interpretador à do Go.

## Motivação

Três defeitos, todos verificados executando o compilador publicado:

**1. `Float` não existe.** `FlexType` (`src/checker.ts`) enumera `Int | String | Bool | Array | Struct | Enum | Map | Void | Any`. O lexer aceita decimais (`lexer.ts:34`, `/^\d+(\.\d+)?/`) e o parser faz `parseFloat`, mas o checker tipa tudo como `Int`. `let preco: Float = 19.90;` falha com `Cannot assign value of type 'Int'` — uma mensagem que descreve o sintoma e esconde a causa (o tipo não existe).

**2. A divisão diverge entre os modos.** Este é o defeito grave:

```flexlang
let x = 7 / 2;
print(x);
```

`flex run` imprime `3.5`; o binário de `flex build` imprime `3`. O interpretador usa a divisão de JavaScript (sempre ponto flutuante); o Go gerado usa `int / int`, que trunca. É uma violação direta da garantia central da linguagem — o mesmo programa, dois resultados.

**3. O parity gate não viu.** `grep` por divisão em `tests/*.flex` não encontra nenhum caso não-exato. A área inteira de aritmética estava sem cobertura de paridade, o que explica o defeito ter sobrevivido a nove RFCs.

Para o público-alvo isso não é acadêmico: preço, taxa, percentual, média e latência são todos ponto flutuante. Uma linguagem de backend sem `Float` não modela um carrinho de compras.

## Design

### 4.1 O tipo

`Float` é IEEE-754 de 64 bits — `float64` em Go, `number` em JavaScript. Um único tipo de ponto flutuante; não há `Float32`. (E não há `Decimal` — ver §4.8.)

```ts
export type FlexType =
  | { kind: "Int" }
  | { kind: "Float" }   // novo
  | { kind: "String" }
  // ...
```

### 4.2 Literais

Um literal numérico **com ponto** é `Float`; **sem ponto**, `Int`.

```flexlang
let quantidade = 3;      // Int
let preco = 19.90;       // Float
```

O ponto exige dígitos dos dois lados: `19.` e `.5` não são literais válidos (o lexer já se comporta assim; passa a ser intencional e documentado). Notação científica (`1e10`) fica fora da v0.2 — é aditiva e pode entrar depois sem quebrar nada.

Na AST, `NumericLiteral` ganha `isFloat: boolean`, decidido pela presença de `.` no lexema. Um nó novo (`FloatLiteral`) foi descartado: obrigaria a tratar dois casos em cada `switch` de expressão, para uma distinção que é um bit.

### 4.3 Sem conversão implícita entre `Int` e `Float`, com uma exceção deliberada

`Int` e `Float` não se misturam:

```flexlang
let n: Int = 3;
let p: Float = 1.5;
let x = n + p;   // ERRO: operador + espera operandos do mesmo tipo (Int e Float)
```

Coerção implícita entre inteiro e ponto flutuante é uma fonte clássica de perda de precisão silenciosa, e a linguagem já se define por "semântica rigorosa".

**A exceção: literais numéricos são _untyped_ até o contexto decidir**, exatamente como constantes não tipadas em Go:

```flexlang
let preco: Float = 19.90;
let com_desconto = preco * 2;      // OK: o literal 2 assume Float
let total: Float = 10;             // OK: o literal 10 assume Float

let quantidade: Int = 3;
let errado = preco * quantidade;   // ERRO: Float * Int — quantidade é variável tipada
```

A regra vale só para **literais escritos no código**, nunca para variáveis. Isso preserva a ergonomia (`preco * 2` é o que qualquer um escreveria) sem abrir a porta para conversões acidentais entre valores. Como o alvo de compilação é Go, que tem exatamente essa semântica de constante não tipada, o codegen sai natural.

No checker, a regra vive em um só ponto: ao verificar um operador binário com um lado `Float` e o outro `Int`, se o lado `Int` for sintaticamente um `NumericLiteral`, ele é promovido; caso contrário, é erro.

Conversões explícitas entre valores: `n.to_float()` e `p.to_int()` (trunca em direção a zero, como a conversão `int(f)` do Go).

### 4.4 Divisão: a correção de paridade

`/` segue o tipo dos operandos, como em Go, Rust, C e Java:

| Expressão | Tipo | Resultado |
|---|---|---|
| `7 / 2` | `Int` | `3` (trunca) |
| `7.0 / 2.0` | `Float` | `3.5` |
| `-7 / 2` | `Int` | `-3` (trunca em direção a zero, como Go — não `-4`) |

**O lado que muda é o interpretador**, que passa a truncar quando ambos os operandos são `Int`. O Go gerado já se comporta assim; alinhar o interpretador ao Go (e não o contrário) mantém a compatibilidade com o alvo de produção e com a expectativa de quem vem dessas linguagens.

A alternativa Python (`/` sempre float, `//` inteira) foi descartada: obrigaria o transpiler a emitir conversões em toda divisão para simular float, divergindo do idioma do alvo, e surpreenderia o público-alvo vindo de Go.

### 4.5 Divisão por zero

Outra divergência silenciosa entre os runtimes, que precisa ser fechada junto:

| Caso | Go | JavaScript (hoje) | FlexLang v0.2 |
|---|---|---|---|
| `7 / 0` (Int) | panic em runtime | `Infinity` | **erro em runtime nos dois modos** |
| `7.0 / 0.0` (Float) | `+Inf` | `Infinity` | `+Inf` nos dois (IEEE-754) |

O interpretador passa a lançar erro em divisão inteira por zero, para casar com o panic do Go. Não é checagem estática (o divisor raramente é literal), é comportamento de runtime.

### 4.6 Módulo (`%`) é só para `Int`

Go **não permite** `%` entre `float64` — é erro de compilação. Como o interpretador usa o `%` do JavaScript, que aceita float, um `1.5 % 2` passaria no checker, rodaria interpretado e **geraria Go que não compila**. O checker passa a rejeitar `%` com operandos `Float`, com mensagem apontando `to_int()`.

Este caso não existe hoje só porque `Float` não existe; ele nasceria junto com esta RFC se não fosse tratado.

### 4.7 Codegen e formatação

- `Float` → `float64`; `Int` → `int` (inalterado).
- **Cuidado com literal inteiro em contexto Float:** `let x: Float = 3;` não pode emitir `x := 3` (que em Go é `int`). Quando o tipo resolvido é `Float` e o literal é inteiro, o transpiler emite `var x float64 = 3`. O transpiler já recebe os tipos resolvidos do checker (`transpiler.transpile(graph, types)`), então a informação necessária está disponível.
- **Formatação em `print`:** Go (`fmt.Println` com `%v`) e JavaScript (`console.log`) usam a mesma estratégia de "menor representação que faz round-trip" para double — `3.0` imprime `3`, `3.5` imprime `3.5`, `0.1 + 0.2` imprime `0.30000000000000004` nos dois. A coincidência é boa mas não é garantida em toda a faixa (notação exponencial em magnitudes extremas), então a bateria de paridade do §5 cobre explicitamente valores grandes, pequenos e negativos.

### 4.8 Não-objetivos

- **`Decimal` de precisão arbitrária.** É o tipo correto para dinheiro, e `Float` não é — mas exige uma biblioteca de precisão arbitrária dos dois lados e uma decisão sobre arredondamento. Fica registrado como candidato de v0.3+, e a documentação deve dizer que `Float` não é adequado para valores monetários que exijam exatidão contábil.
- **`Int64`/`Int32`/`UInt`.** `Int` continua sendo o `int` do Go.
- **Notação científica** (§4.2).

## Plano de testes

A ausência de teste foi a causa raiz. A cobertura nova é a entrega mais importante desta RFC, e vai toda para o **parity gate** (interpretado vs. compilado, saída byte a byte):

1. **Bateria aritmética**: `+ - * / %` para `Int`/`Int` e `Float`/`Float`, com positivos e negativos.
2. **Divisão truncada**: `7/2`, `-7/2`, `1/2` — o caso que deu origem à RFC.
3. **Literal untyped**: `preco * 2`, `let x: Float = 10`, e o caso negativo (`Float * Int` com variável) falhando no checker.
4. **Divisão por zero**: `Int` erra em ambos os modos; `Float` dá `+Inf` em ambos.
5. **`%` com `Float`** é rejeitado pelo checker (negativo).
6. **Formatação**: `3.0`, `3.5`, `0.1+0.2`, `1e21`, `-0.0`, valores muito pequenos — o teste que valida a suposição do §4.7.
7. **Conversões**: `to_int()` truncando em direção a zero (inclusive negativos), `to_float()`.
8. **Struct com campo `Float`** serializando em JSON igual nos dois modos (conecta com `res.json`, RFC-004).

## Critério de aceite

- [ ] `Float` existe como tipo, com literais e anotação (`let preco: Float = 19.90`).
- [ ] `7 / 2` produz `3` nos **dois** modos.
- [ ] Literais numéricos se adaptam ao contexto; variáveis de tipos diferentes não.
- [ ] `%` com `Float` é erro de compilação, não Go inválido.
- [ ] Divisão inteira por zero falha nos dois modos.
- [ ] Toda a bateria do §5 no parity gate, verde.

## Alternativas consideradas

- **`/` sempre float, `//` inteira (Python)** — §4.4: diverge do alvo Go e do público-alvo.
- **Coerção implícita `Int` → `Float`** — §4.3: perda de precisão silenciosa; a exceção para literais entrega a ergonomia sem o risco.
- **Manter o interpretador com divisão float e converter no Go** — descartada: emitir conversões em toda divisão produz Go não idiomático e mais lento, para preservar justamente o comportamento que causou o defeito.
- **Um nó `FloatLiteral` na AST** — §4.2: dobra o número de casos em cada `switch` por um único bit de informação.
