# RFC-014: Diagnósticos do Compilador

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** nada (mas RFC-011/013 se beneficiam dela; ver PRD §3)
> **Toca:** `src/ast.ts`, `src/parser.ts`, `src/checker.ts`, `src/loader.ts`, `src/cli.ts`, e um `src/diagnostics.ts` novo

## Resumo

Nenhuma mensagem de erro da FlexLang diz **onde** o erro está, e todas chegam ao usuário acompanhadas do stack trace interno do compilador. Esta RFC leva os spans que o lexer já coleta até os diagnósticos, e substitui o despejo de exceção por um formato legível.

## Motivação

Este é o erro que um usuário da v0.1.1 recebe hoje ao anotar um tipo errado:

```
Error: TypeError: Cannot assign value of type 'Int' to variable 'preco' of type 'Float'
    at TypeChecker.checkStmt (file:///.../dist/cli.js:2165:17)
    at TypeChecker.check (file:///.../dist/cli.js:2149:14)
    at runRun (file:///.../dist/cli.js:4307:11)
    at async main (file:///.../dist/cli.js:4448:11)
```

Três problemas independentes: (a) não diz em que arquivo, linha ou coluna — em um projeto multi-arquivo (RFC-006), é uma caça manual; (b) expõe o interior do compilador, ruído absoluto para quem escreve FlexLang; (c) mostra offsets do *bundle* (`dist/cli.js:2165`), que nem para depurar o compilador servem.

A causa técnica é precisa: os **tokens** carregam `line`/`column` (`ast.ts:63-64`, preenchidos em `lexer.ts:127` e `lexer.ts:137`), mas **os nós da AST não** — o parser lê o token, extrai o valor e descarta a posição. Sem span no nó, o checker não tem o que reportar. A RFC-001 listava "spans em tokens, AST e diagnósticos" como entregável da Fase 0; a primeira metade foi feita e a segunda não.

Agora que a linguagem está publicada, a qualidade da mensagem de erro é parte da superfície pública: é o que um avaliador encontra nos primeiros dez minutos.

## Design

### 3.1 `Span` na AST

```ts
export interface Span {
  file: string;    // caminho absoluto — obrigatório em projeto multi-arquivo
  line: number;    // 1-based
  column: number;  // 1-based
  endLine: number;
  endColumn: number;
}
```

Todos os nós de `Stmt` e `Expr` ganham `span?: Span`. **Opcional** por pragmatismo: torná-lo obrigatório exigiria preencher dezenas de construções de nó em um único commit gigante, sem checagem parcial possível. Opcional permite priorizar (§3.2) e converter o restante incrementalmente, com o compilador funcionando o tempo todo.

O parser marca o token inicial antes de parsear e o final depois, e monta o span — os dois já estão disponíveis em `this.current()`. O `file` vem do `SourceFile.filePath` que o `loader.ts` já resolve.

### 3.2 Prioridade de cobertura

Os nós que hoje aparecem em mensagens de erro vêm primeiro, porque são os que rendem diagnóstico melhor imediatamente:

1. `VarDeclaration`, `AssignmentExpr` — erros de tipo e de mutabilidade (os mais comuns).
2. `CallExpr`, `MemberExpr` — aridade, método inexistente, `server.route` removido (RFC-011 §5.5).
3. `BinaryExpr` — operandos incompatíveis, `%` com `Float` (RFC-013 §4.6).
4. `MatchStmt` e braços — exaustividade.
5. `Identifier` — símbolo não encontrado.
6. `ImportDeclaration` — módulo inexistente, ciclo de import.

O restante segue depois; um diagnóstico sem span degrada para o formato antigo (mensagem sem localização), nunca quebra.

### 3.3 `FlexError`

```ts
export class FlexError extends Error {
  constructor(
    readonly code: string,        // "E2001"
    message: string,              // "cannot assign Int to variable of type Float"
    readonly span?: Span,
    readonly help?: string,       // "use a float literal: `19.0`"
  ) { super(message); }
}
```

Todo `throw new Error("TypeError: ...")` do checker vira um `FlexError`. Os códigos são agrupados por categoria, para que possam ser referenciados em documentação e busca:

| Faixa | Categoria |
|---|---|
| `E1xxx` | Léxico e sintaxe |
| `E2xxx` | Tipos |
| `E3xxx` | Mutabilidade e move semantics |
| `E4xxx` | Módulos e imports |
| `E5xxx` | Concorrência (`spawn` fora de `scope`, etc.) |

Um catálogo é bom (permite `flex explain E2001` no futuro), mas atribuir código a cada erro existente de uma vez é trabalho mecânico e volumoso. A regra: **todo erro tocado por esta RFC ou pelas RFCs 011/013 recebe código**; os demais migram quando forem tocados. O que não vale é inventar um código genérico `E0000` para o resto — código sem significado é pior que código nenhum.

### 3.4 Formato de saída

```
error[E2001]: cannot assign value of type `Int` to variable of type `Float`
 --> src/handlers/products.flex:12:20
   |
12 | let preco: Float = 19;
   |                    ^^ expected `Float`, found `Int`
   |
help: literais decimais são Float — use `19.0`
```

Estrutura deliberadamente próxima da do Rust, que é o estado da arte reconhecido em mensagens de compilador: código legível na primeira linha, caminho clicável (`arquivo:linha:coluna` é o formato que editores e terminais linkam), o trecho real do código com o intervalo marcado, e uma sugestão acionável quando existir.

Detalhes que fazem diferença na prática:
- **Cor apenas quando a saída é um TTY** — em CI e em pipes, ANSI vira lixo no log. `process.stdout.isTTY`.
- **Tabs contam como largura** ao alinhar o `^^^`, senão o marcador escorrega em arquivos indentados com tab.
- **Linhas muito longas** são truncadas com reticências mantendo a coluna do erro visível.

### 3.5 Fronteira da CLI

`src/cli.ts` passa a distinguir dois mundos:

- **`FlexError`** → formata como §3.4, `exit 1`, **sem stack trace**. É erro no código do usuário.
- **Qualquer outra exceção** → é bug do compilador. Mensagem explícita como tal, com pedido de reporte e link para as issues, e a stack só com `--debug`:

```
erro interno do compilador: Cannot read properties of undefined (reading 'kind')

Isto é um bug da FlexLang, não do seu código.
Reporte em https://github.com/pedro2s/flexlang/issues (use --debug para a stack completa).
```

Essa separação também melhora o relatório de bug que chega ao projeto: hoje um usuário não tem como saber se errou ou se o compilador quebrou.

### 3.6 Interação com `--watch`

O watcher (RFC-012 §3.5) imprime o diagnóstico formatado e continua observando. `FlexError` precisa ser serializável entre o processo filho e o pai — outra razão para o erro ser um objeto estruturado, e não uma string já formatada.

### 3.7 Não-objetivos

- **Múltiplos erros por execução.** O checker para no primeiro (`throw`). Coletar e continuar exige recuperação de erro em todo o percurso e produz cascatas de erros derivados; é uma RFC própria.
- **Sugestão por proximidade** ("did you mean `lenght`?"). Bom retorno por pouco esforço, mas depende de spans e códigos estarem no lugar primeiro.
- **Warnings.** Só existe erro. Um sistema de níveis pede supressão, configuração e política — nada disso se justifica agora.
- **Protocolo LSP / integração com editor.** Depende de spans (esta RFC é o pré-requisito), mas é um produto à parte.

## Plano de testes

Mensagens de erro são contrato observável — e a suíte golden-file já as compara byte a byte, então o formato fica travado contra regressão automaticamente.

1. Atualizar os goldens negativos existentes (`15_match_nao_exaustivo`, `18_result_redeclarado`, `21_try_erro_incompativel`, `10_traits_fail`) para o formato novo, com linha e coluna corretas.
2. Erro em arquivo **importado** aponta o caminho do arquivo certo, não o da entrada — a regressão mais provável em projeto multi-arquivo.
3. Nenhuma saída de erro contém `at ` seguido de caminho de `dist/` (asserção direta contra o vazamento de stack).
4. Erro interno simulado produz a mensagem de "bug do compilador", e a stack só aparece com `--debug`.
5. Sem TTY, a saída não contém sequências ANSI.
6. Arquivo indentado com tab alinha o marcador `^^^` corretamente.

## Critério de aceite

- [ ] Erros de tipo, mutabilidade, aridade e import citam arquivo, linha e coluna.
- [ ] O trecho de código aparece com o intervalo marcado.
- [ ] Nenhum stack trace do Node em erro de usuário; `--debug` para inspecionar.
- [ ] Erro interno é rotulado como bug do compilador.
- [ ] Cor só em TTY.

## Alternativas consideradas

- **Só o número da linha, sem trecho de código** — mais barato, mas o trecho é o que elimina a ida e volta ao editor. Metade do valor por 80% do custo.
- **Span obrigatório em todos os nós já nesta RFC** — §3.1: um commit único e enorme, sem estados intermediários testáveis.
- **Reaproveitar o stack trace do Node mapeando para o fonte `.flex`** — inviável: o interpretador é tree-walking, a pilha do Node reflete a estrutura do interpretador, não a do programa do usuário.
