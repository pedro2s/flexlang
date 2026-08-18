# Walkthrough: Implementação da RFC-024 — Declarações `const` de Nível de Módulo

Implementamos com sucesso a especificação [RFC-024](file:///home/pedro/dev/pedro/flexlang/.docs/v0.3/rfcs/rfc-024-const-declarations.md) na linguagem FlexLang, introduzindo declarações de constantes imutáveis de nível de módulo (`const`) com checagem estática de literais, proibição de reatribuição e emissão nativa em Go.

---

## 🛠️ Recursos Implementados

1. **Sintaxe de Constantes**:
   ```flexlang
   const MAX_RETRIES = 3;
   const TAX_RATE = 0.15;
   const BANK_NAME = "FlexBank S.A.";
   const IS_PROD = true;
   const MAX_LIMIT: Int = 10000;
   ```

2. **Regras e Validações Estáticas**:
   - Inicializadores devem ser literais computáveis em tempo de compilação (números, strings, booleans). Inicializações com chamadas de função ou expressões dinâmicas emitem `E2034`.
   - Reatribuição a constantes é estritamente proibida e emite o erro `E3003` ("Cannot assign to constant").

3. **Mapeamento Go**:
   - Emissão de declarações `const NAME = value` (ou com tipo explícito) no nível de pacote do Go.

---

## 🔧 Alterações por Componente

1. **AST & Lexer ([`src/ast.ts`](file:///home/pedro/dev/pedro/flexlang/src/ast.ts), [`src/lexer.ts`](file:///home/pedro/dev/pedro/flexlang/src/lexer.ts))**:
   - Adição do token `TokenType.Const` e do nó `ConstDeclaration`.

2. **Parser ([`src/parser.ts`](file:///home/pedro/dev/pedro/flexlang/src/parser.ts))**:
   - Método `parseConstDeclaration` reconhecendo declarações `const`.

3. **Type Checker ([`src/checker.ts`](file:///home/pedro/dev/pedro/flexlang/src/checker.ts))**:
   - Rastreamento da flag `isConst` no `TypeEnvironment`.
   - Validação de literais (`E2034`) e bloqueio de reatribuição (`E3003`).

4. **Interpretador & Transpiler Go ([`src/interpreter.ts`](file:///home/pedro/dev/pedro/flexlang/src/interpreter.ts), [`src/transpiler.ts`](file:///home/pedro/dev/pedro/flexlang/src/transpiler.ts))**:
   - Registro de constantes no ambiente de execução.
   - Emissão de declarações `const` de pacote no Go.

---

## 🧪 Testes e Validação

### Resultados dos Testes:
1. **Novo Teste Golden [`tests/43_const_declarations.flex`](file:///home/pedro/dev/pedro/flexlang/tests/43_const_declarations.flex)**:
   - Declaração de constantes de todos os tipos primitivos.
   - Uso de constantes em cálculos aritméticos e interpolação.
2. **Suíte Golden Completa**:
   ```bash
   $ npm test
   Tests Completed: 43 passed, 0 failed.
   ```
3. **Paridade Node ↔ Go**:
   ```bash
   $ npm run test:parity
   Parity gate: 38 passaram, 0 falharam, 5 sem comparação de stdout.
   ```
4. **Testes da Extensão VSCode**:
   ```bash
   $ npm run test:vscode
   ✅ Sucesso: RFC-024: declarações const de nível de módulo validadas
   ✅ Sucesso: RFC-024: reatribuição de const emite erro estático E3003
   ✅ Sucesso: RFC-024: const inicializada com função emite erro estático E2034
   ✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!
   ```
