# RFC-003: Motor de Diagnósticos em Tempo Real e Quick Fixes

| Metadado | Detalhe |
|---|---|
| **Número da RFC** | RFC-003 (VSCode Tooling) |
| **Título** | Ponte de Diagnósticos do Compilador, Taxonomia de Erros e Quick Fixes |
| **Status** | Aprovado |
| **Autor** | Pedro Santana / Time de Ferramentas FlexLang |
| **Data** | Agosto/2026 |

---

## 1. Contexto

A FlexLang segue o princípio de **feedback explicativo e imediato** inspirado nos compiladores modernos como Rust e Elm. Diagnósticos no VSCode devem ir além de um sublinhado vermelho: eles precisam apontar a causa raiz, exibir o trecho exato no código e sugerir correções acionáveis (*actionable help*).

Esta RFC descreve como o Language Server converte a classe `FlexError` do compilador em `Diagnostic` do LSP e como gera ações de correção automática (`CodeAction`).

---

## 2. Taxonomia de Códigos de Erro da FlexLang

Os erros da FlexLang são categorizados por faixas numéricas de acordo com a fase do compilador:

| Faixa | Categoria | Exemplos de Códigos | Descrição |
|---|---|---|---|
| **`E1000 - E1999`** | **Léxico e Sintático** | `E1001`, `E1002` | Tokens inesperados, strings não terminadas, parênteses/chaves desbalanceados. |
| **`E2000 - E2999`** | **Tipagem e Semântica** | `E2001`, `E2002` | Incompatibilidade de tipos, função chamada com número incorreto de argumentos, tipo não declarado. |
| **`E3000 - E3999`** | **Mutabilidade e Posse (Move Semantics)** | `E3001`, `E3002` | Atribuição a variável imutável sem `mut`, uso de variável após envio em canal (*use-after-send*). |
| **`E4000 - E4999`** | **Módulos e Imports** | `E4001`, `E4002` | Módulo não encontrado, ciclo de importação detectado, símbolo não exportado. |
| **`E5000 - E5999`** | **Concorrência e Runtime** | `E5001`, `E5002` | `spawn` fora de bloco `scope`, deadline de escopo inválido. |

---

## 3. Mapeamento do `FlexError` para `Diagnostic` do LSP

Cada erro emitido pelo compilador FlexLang contém a seguinte estrutura:

```typescript
export class FlexError extends Error {
  constructor(
    readonly code: string,        // Ex: "E2001"
    message: string,              // Mensagem principal
    readonly span?: Span,         // Localização exata (file, line, column, endLine, endColumn)
    readonly help?: string,       // Dica de correção ("Adicione 'let mut' para permitir reatribuição")
    readonly label?: string,
  )
}
```

### Conversão para o LSP:
1. **Range**: O `Span` (base 1) é convertido para `Range` (base 0):
   ```typescript
   const start = { line: span.line - 1, character: span.column - 1 };
   const end = { line: span.endLine - 1, character: span.endColumn - 1 };
   ```
2. **Severity**: Mapeado para `DiagnosticSeverity.Error`.
3. **Message Format**:
   ```
   [E2001] Cannot assign to immutable variable 'total'
   
   💡 Dica: Declare a variável com 'let mut total = ...' para torná-la mutável.
   ```
4. **Code**: Código padronizado `"E2001"`.
5. **Source**: `"flexlang"`.

---

## 4. Motor de Code Actions (Quick Fixes)

O servidor implementa `connection.onCodeAction` para prover correções com 1 clique (`Ctrl+.` ou `Cmd+.`):

### Cenários Suportados:
1. **Tornar Variável Mutável (`E2001` / `E3001`)**:
   - Detecta atribuição a `let x = ...`.
   - Oferece Quick Fix: `"Adicionar modificador 'mut' à declaração de 'x'"`.
2. **Formatar Arquivo em Caso de Erros de Espaçamento**:
   - Dispara o `FlexFormatter` para regularizar o código.
3. **Importação Automática de Módulos da Stdlib**:
   - Ao detectar tipos como `Server` ou `Pool` sem import, sugere a inserção automática de `import { Server } from "net/http";` no topo do arquivo.
