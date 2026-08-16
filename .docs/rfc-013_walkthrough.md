# Implementação da RFC-013: Tipo `Float` e Paridade Aritmética

Este walkthrough resume as implementações e validações da **RFC-013**, introduzindo o tipo `Float` (IEEE-754 de 64 bits / `float64` em Go) e alinhando a semântica numérica entre o interpretador (`flex run`) e o compilador Go (`flex build`), garantindo paridade total de execução.

## 1. O Tipo `Float` e Literais

- **Representação interna**: `Float` é adicionado ao `FlexType` no checker e mapeado para `float64` no Go e `number` no JavaScript.
- **Literais com ponto**: Literais numéricos contendo ponto decimal (`19.90`, `3.0`) são tipados como `Float` com `isFloat: true` na AST (`NumericLiteral`).
- **Literais untyped e adaptação contextual**: Literais numéricos inteiros no código fonte adaptam-se quando usados em contexto de `Float` (ex: `preco * 2` ou `let total: Float = 10;`), preservando a ergonomia sem permitir coerção implícita entre variáveis tipadas.
- **Proibição de mistura implícita de variáveis**: Operações como `preco * quantidade` (onde `quantidade: Int`) são rejeitadas pelo checker em tempo de compilação.

## 2. Divisão e Paridade Aritmética

- **Divisão Inteira (`/`)**: No modo interpretado, divisões entre `Int` passam a truncar em direção a zero (`Math.trunc`), produzindo `3` para `7 / 2` e `-3` para `-7 / 2`, exatamente igual ao `int / int` do Go.
- **Divisão por Zero**:
  - `Int`: Lança erro de runtime (`RuntimeError: division by zero`) em ambos os modos.
  - `Float`: Produz `+Inf`, `-Inf` ou `NaN` conforme o padrão IEEE-754 em ambos os modos.
- **Operador Módulo (`%`)**: Restrito exclusivamente a operandos do tipo `Int`. Operações com `Float` são rejeitadas estaticamente pelo checker.
- **Conversões Explícitas**: Suporte aos métodos `.to_float()` (em `Int` e `Float`) e `.to_int()` (em `Float` e `Int`, truncando em direção a zero).

## 3. Formatação e Codegen Go

- **Codegen Go**:
  - `Float` é emitido como `float64`.
  - Variáveis tipadas explicitamente como `Float` que recebem literais inteiros emitem `var x float64 = 10` para manter a tipagem forte em Go.
  - Chamadas `.to_float()` viram `float64(x)` e `.to_int()` viram `int(x)`.
- **Formatação em `print`**: Saídas como `+Inf`, `-Inf`, `NaN` e `0` (para `-0.0`) são formatadas de maneira idêntica entre o interpretador e o `fmt.Println` do Go.

## 4. Bateria de Testes e Parity Gate

- **`tests/33_float_arithmetic.flex`**: Cobre a bateria completa de operações aritméticas, divisão truncada, untyped literals, conversões, divisão por zero, formatação e structs com campos `Float`.
- **`tests/34_float_type_mismatch.flex`**: Teste negativo validando rejeição estática ao multiplicar variáveis `Float` e `Int`.
- **`tests/35_modulo_float.flex`**: Teste negativo validando rejeição estática de `%` com `Float`.

## Resultados de Validação

- `npm test`: 35/35 testes golden passaram.
- `npm run test:parity`: 35/35 testes no parity gate (30 testes com saída idêntica byte a byte e 5 com verificação não determinística de concorrência/log).
- `npm run test:http`: 32/32 testes de integração HTTP passando em ambos os modos.
- `npm run build`: Build de distribuição gerado com sucesso pelo `tsup`.
