# RFC-002: Gramática de Sintaxe, Semântica e Formatador Automático

| Metadado | Detalhe |
|---|---|
| **Número da RFC** | RFC-002 (VSCode Tooling) |
| **Título** | Especificação da Gramática TextMate, Formatador de Código e Snippets |
| **Status** | Aprovado |
| **Autor** | Pedro Santana / Time de Ferramentas FlexLang |
| **Data** | Agosto/2026 |

---

## 1. Contexto

A legibilidade e estética de uma linguagem de programação dependem diretamente da harmonia entre o **realce de sintaxe (Syntax Highlighting)** e a **padronização de estilo (Code Formatting)**.

Esta RFC especifica as regras formais para a gramática TextMate, os escopos de cores recomendados e o algoritmo determinístico de formatação de código da FlexLang.

---

## 2. Taxonomia de Escopos TextMate

A gramática `syntaxes/flexlang.tmLanguage.json` adota a hierarquia padrão do TextMate com escopo raiz `source.flex`:

| Categoria | Expressão Regular / Palavra | Escopo TextMate |
|---|---|---|
| **Declaração de Variável** | `let`, `const` | `keyword.declaration.variable.flex` |
| **Mutabilidade** | `mut` | `storage.modifier.mut.flex` |
| **Concorrência Estruturada** | `scope`, `spawn` | `keyword.control.concurrency.flex` |
| **Controle de Fluxo** | `if`, `else`, `match`, `for`, `in`, `while`, `return` | `keyword.control.flow.flex` |
| **Módulos / Imports** | `import`, `from` | `keyword.control.import.flex` |
| **Declaração de Tipos** | `struct`, `impl`, `trait`, `enum`, `func` | `keyword.declaration.type.flex` |
| **Referência Própria** | `self` | `variable.language.self.flex` |
| **Tipos Primitivos** | `Int`, `Float`, `String`, `Bool`, `Void`, `Any`, `Map` | `support.type.primitive.flex` |
| **Tipos Embutidos** | `Result`, `Option`, `Channel` | `support.type.builtin.flex` |
| **Variantes de Enum** | `Ok`, `Err`, `Some`, `None` | `constant.language.variant.builtin.flex` |
| **Interpolação de Strings** | `"${...}"` ou `"{var}"` | `meta.interpolation.flex` |
| **Comentários de Doc** | `/// ...` ou `/** ... */` | `comment.block.documentation.flex` |
| **Operadores de Controle** | `->`, `=>`, `?`, `..` | `keyword.operator.control.*.flex` |

---

## 3. Algoritmo do Formatador Automático (`FlexFormatter`)

O formatador opera em modo determinístico, garantindo que qualquer código formatado duas vezes consecutivas produza o mesmo resultado exato (idempotência).

### Regras de Formatação:
1. **Indentação de Blocos**:
   - Cada abertura de chave `{`, colchete `[` ou parêntese `(` incrementa o nível de indentação em 1 unidade (padrão: 4 espaços).
   - Linhas que iniciam com fechamento `}`, `]` ou `)` decrementam a indentação antes de sua renderização.
   - Cláusulas compostas como `} else {` ou `} else if (...) {` são mantidas na mesma linha com espaçamento uniforme.

2. **Espaçamento de Operadores**:
   - Operadores de controle (`->`, `=>`) recebem 1 espaço à esquerda e 1 à direita (`a -> b`).
   - Operadores relacionais (`==`, `!=`, `<`, `<=`, `>`, `>=`) e lógicos (`&&`, `||`) são espaçados bilateralmente.
   - Operadores aritméticos (`+`, `-`, `*`, `/`, `%`) recebem espaçamento quando utilizados em expressões binárias.
   - O operador de range (`..`) permanece colado aos seus operandos (`0..10`).

3. **Espaçamento de Pontuação**:
   - Vírgulas `,` e pontos-e-vírgulas `;` são seguidos por 1 espaço.
   - Dois-pontos `:` em tipagem e structs recebem 1 espaço após o símbolo (`campo: Tipo`).

4. **Preservação de Comentários e Linhas em Branco**:
   - Comentários de linha (`//`, `///`) e de bloco (`/* ... */`) têm sua integridade preservada.
   - Sequências de múltiplas linhas vazias são condensadas para no máximo 1 linha vazia.

---

## 4. Catálogo de Snippets

Os snippets em `snippets/flexlang.json` fornecem aceleração de desenvolvimento com tabstops nomeados (`$1`, `$2`, `$0`):
- `func`: Assinatura completa com tipos e bloco.
- `main`: Função de entrada pronta para execução.
- `struct` / `impl` / `impl-trait`: Modelagem orientada a dados e comportamento.
- `enum` / `match-result` / `match-option`: Desestruturação segura com tratamento de erros.
- `http-server` / `http-route`: Setup completo de APIs backend.
- `db-pool` / `db-query`: Acesso seguro a bancos de dados relacionais.
- `scope` / `spawn` / `channel`: Programação concorrente sem data races.
