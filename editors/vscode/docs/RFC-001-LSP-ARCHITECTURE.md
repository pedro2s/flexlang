# RFC-001: Arquitetura do FlexLang Language Server (LSP)

| Metadado | Detalhe |
|---|---|
| **Número da RFC** | RFC-001 (VSCode Tooling) |
| **Título** | Arquitetura do Servidor de Linguagem FlexLang (LSP 3.17) |
| **Status** | Aprovado |
| **Autor** | Pedro Santana / Time de Ferramentas FlexLang |
| **Data** | Agosto/2026 |

---

## 1. Contexto e Motivação

O **Language Server Protocol (LSP)** padroniza a comunicação entre editores de código e servidores que provêm inteligência de linguagem (diagnósticos, auto-completar, definição, formatação, etc.).

Ao invés de duplicar a lógica de análise em cada editor, a FlexLang implementa um servidor LSP desacoplado e reutilizável que consome as fases do próprio compilador (`Lexer`, `Parser`, `TypeChecker`, `Loader`).

---

## 2. Ciclo de Vida e Inicialização

```
VSCode Client                            FlexLang LSP Server
      │                                           │
      ├────── initialize (capacidades) ──────────►│
      │◄───── initializeResult (capacidades) ─────┤
      ├────── initialized (notificação) ─────────►│
      │                                           │
      │  === Operação Regular de Edição ===       │
      │                                           │
      ├────── textDocument/didOpen ──────────────►│ (Analisa e emite diagnósticos)
      ├────── textDocument/didChange ────────────►│ (Revalida AST e cache)
      ├────── textDocument/hover ────────────────►│ (Retorna markdown contextual)
      ├────── textDocument/completion ───────────►│ (Retorna lista de símbolos)
      ├────── textDocument/formatting ───────────►│ (Retorna TextEdits)
      │                                           │
      ├────── shutdown ──────────────────────────►│
      │◄───── resposta ok ────────────────────────┤
      ├────── exit ──────────────────────────────►│ (Encerra processo)
```

### Capacidades Negociadas no `onInitialize`:
- `textDocumentSync`: `TextDocumentSyncKind.Full` (envio do conteúdo completo do documento a cada alteração para análise garantida e sem estados corrompidos).
- `hoverProvider`: Habilitado para prover documentação formatada em Markdown de tipos, métodos e módulos.
- `completionProvider`: Habilitado com caracteres de gatilho `[".", ":", '"', "/", "<", " "]`.
- `documentFormattingProvider`: Habilitado com o motor `FlexFormatter`.
- `documentSymbolProvider`: Habilitado para suporte à árvore de navegação do Outline e Breadcrumbs.
- `definitionProvider`: Habilitado para navegação local e inter-módulos.
- `signatureHelpProvider`: Habilitado com gatilhos de digitação `["(", ","]`.
- `codeActionProvider`: Habilitado para Quick Fixes.

---

## 3. Pipeline de Diagnósticos e Sincronização de Documentos

Quando o evento `textDocument/didChange` ou `textDocument/didOpen` é recebido:
1. O texto atual é recuperado da memória (`TextDocuments`).
2. O `Lexer` quebra a string em tokens categorizados com número de linha e coluna exatos.
3. O `Parser` constrói a árvore sintática abstrata (`AST`). Em caso de erro gramatical (`FlexError`), a localização de início e fim (`Span`) é mapeada diretamente para o `Range` do protocolo LSP.
4. O `TypeChecker` executa a checagem em 2 passos:
   - **Passo 1 (Hoisting)**: Registra declarações de tipos (`struct`, `enum`, `trait`, `func`).
   - **Passo 2 (Deep Type Check)**: Valida inferência de tipos, modificadores de mutabilidade `mut`, regras de concorrência (`scope`/`spawn`), canais tipados e conformidade de traits.
5. A coleção resultante de diagnósticos (`Diagnostic[]`) é despachada via `connection.sendDiagnostics`.

---

## 4. Resolução de Módulos Locais e Grafo de Dependências

Para recursos como **Go to Definition** e validação multi-arquivos:
- O servidor utiliza o módulo `loader.ts` do compilador (`resolveModuleFilePath`, `isLocalModule`).
- Quando um símbolo como `import { handle_login } from "./routes/auth_routes"` é clicado com `F12`:
  1. O servidor localiza o `ImportDeclaration` correspondente na AST.
  2. Resolve o caminho absoluto do arquivo no disco (`./routes/auth_routes.flex`).
  3. Retorna um `Location` contendo a URI `file:///.../routes/auth_routes.flex` na posição inicial do arquivo.

---

## 5. Estratégia de Caching e Performance

- A AST de cada documento ativo é armazenada em memória no `documentCache`.
- Quando um documento é fechado (`textDocument/didClose`), o cache e a lista de diagnósticos são limpos para evitar vazamentos de memória.
- Operações assíncronas no Node.js garantem que requisições pesadas não bloqueiem a interface do usuário.
