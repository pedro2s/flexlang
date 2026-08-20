# Implementação da RFC-014: Diagnósticos do Compilador

Este walkthrough resume a implementação e validação da **RFC-014**, que introduz o sistema de diagnósticos ricos e amigáveis para o compilador da FlexLang, eliminando vazamentos de stack trace e oferecendo mensagens de erro formatadas no padrão Rust com localização exata (arquivo, linha e coluna) e sublinhado no código fonte.

## 1. Rastreamento de Localização (`Span`)

- **Estrutura de `Span` (`src/ast.ts`)**: Adicionada a interface `Span` contendo `{ file, line, column, endLine, endColumn }`.
- **Propagação na AST (`src/parser.ts`)**:
  - O `Parser` recebe o caminho do arquivo de origem (`filePath`) e calcula `span` para todos os nós de declarações (`Stmt`) e expressões (`Expr`).
  - Funções utilitárias `spanFrom(start, end)` e `combineSpans(start, end)` garantem cobertura precisa de nós compostos (chamadas encadeadas, acessos a propriedades, blocos, etc.).
- **Grafo de Módulos (`src/loader.ts`)**: O carregador propaga o caminho resolvido de cada módulo para o parser, garantindo que diagnósticos em arquivos importados apontem para o arquivo e linha corretos.

## 2. Formatador de Diagnósticos (`src/diagnostics.ts`)

- **Classe `FlexError`**: Exceção estruturada contendo código categorizado (`E1xxx` a `E5xxx`), `span`, mensagem de erro, label inline e texto de ajuda (`help`).
- **Formatador `formatDiagnostic`**:
  - Cabeçalho: `error[EXXXX]: mensagem`
  - Ponteiro para editor/IDE: ` --> caminho/arquivo:linha:coluna`
  - Visualização de código: Gutter numerado e sublinhado com marcadores `^^^^` sob o token/expressão causador.
  - Alinhamento de tabs: Expansão de caracteres de tabulação para manter alinhamento perfeito do sublinhado.
  - Seção `help:` para sugestões acionáveis de correção (ex: sugerir `.to_float()` ou `.to_int()`).
  - Cores ANSI controladas automaticamente (emitidas apenas quando `isTTY: true`).

## 3. Integração com TypeChecker e CLI

- **`src/checker.ts`**: Migração de todos os erros de compilação, tipos, mutabilidade, módulos e concorrência para `FlexError` com códigos e spans apropriados.
- **`src/cli.ts`**:
  - Erros do usuário (`FlexError`) são formatados sem stack trace interno do Node.js.
  - Erros inesperados são identificados como bugs do compilador ("erro interno do compilador: ... / Isto é um bug da FlexLang"), orientando a abertura de issue no repositório. O stack trace completo só é exibido mediante o uso da flag `--debug`.

## 4. Bateria de Testes

- **`tests/36_compiler_diagnostics.ts`**: Nova suíte cobrindo:
  - Spans em arquivos importados vs arquivo de entrada.
  - Formatação sem ANSI para `isTTY: false` e com ANSI para `isTTY: true`.
  - Alinhamento de ponteiro `^^^^` em código com tabulação.
  - Ausência de vazamento de frames internos (`dist/` ou `at TypeChecker`).
- **Testes Golden (`tests/runner.ts`)**: 12 testes negativos atualizados com os diagnósticos detalhados.

## Resultados de Validação

- `npm test`: 35/35 testes golden aprovados.
- `npm run test:parity`: 35/35 testes no parity gate (30 testes com saída idêntica e 5 testes com verificação não determinística).
- `npx tsx tests/36_compiler_diagnostics.ts`: 18/18 asserções de diagnósticos aprovadas.
- `npm run test:http`: 32/32 testes de integração HTTP aprovados em ambos os modos.
- `npx tsx tests/28_module_errors.ts` & `tests/32_security_baseline.ts`: 100% de sucesso.
- `npm run build`: Build de produção (`dist/cli.js`) gerado com sucesso sem avisos.
