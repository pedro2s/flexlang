import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  Hover,
  MarkupKind,
  DocumentSymbol,
  SymbolKind,
  Definition,
  Location,
  Range,
  Position,
  TextEdit,
  CodeAction,
  CodeActionKind,
  SignatureHelp,
  ParameterInformation,
  SignatureInformation,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import * as fs from "fs";

import { Lexer } from "../../../../src/lexer";
import { Parser } from "../../../../src/parser";
import { TypeChecker } from "../../../../src/checker";
import { FlexError } from "../../../../src/diagnostics";
import { resolveModuleFilePath, isLocalModule } from "../../../../src/loader";
import { FlexFormatter } from "../formatter/formatter";
import type {
  Stmt,
  FunctionDeclaration,
  StructDeclaration,
  EnumDeclaration,
  TraitDeclaration,
  ImplDeclaration,
  VarDeclaration,
  ImportDeclaration,
  TypeNode,
} from "../../../../src/ast";

// Criação da conexão LSP padrão sobre IPC/pipes
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Cache de ASTs analisadas por URI do documento
interface DocumentAnalysis {
  ast: Stmt[];
  errors: FlexError[];
}
const documentCache = new Map<string, DocumentAnalysis>();

// Instância do formatador oficial
const formatter = new FlexFormatter();

// --- Documentação embutida da biblioteca padrão (Stdlib) ---
const STDLIB_DOCS: Record<string, string> = {
  "Server": "### `Server (net/http)`\nServidor HTTP nativo de alto desempenho da FlexLang.\n\n```flexlang\nlet mut server = Server.new(\":3000\", config);\nserver.get(\"/rota\", handler);\nserver.start();\n```",
  "ServerConfig": "### `ServerConfig (net/http)`\nConfiguração de execução do servidor HTTP.\n- `read_timeout`: Tempo limite em milissegundos para leitura de requests.\n- `max_body_size`: Tamanho máximo do corpo da requisição em bytes.",
  "CorsConfig": "### `CorsConfig (net/http)`\nConfiguração de Cross-Origin Resource Sharing (CORS).\n- `allow_origins`: Lista de origens autorizadas\n- `allow_methods`: Lista de verbos HTTP autorizados\n- `allow_headers`: Cabeçalhos HTTP permitidos\n- `max_age`: Tempo de cache do Preflight em segundos",
  "Request": "### `Request (net/http)`\nObjeto que encapsula a requisição HTTP recebida.\n- `method`: Método HTTP (GET, POST, etc.)\n- `path`: Caminho requisitado\n- `params`: Parâmetros de rota dinâmicos (`:id`)\n- `header(name)`: Lê um cabeçalho de forma case-insensitive\n- `json()`: Faz o parsing seguro do payload JSON",
  "Response": "### `Response (net/http)`\nObjeto para construção e envio da resposta HTTP.\n- `json(status, data)`: Envia payload JSON com cabeçalho `application/json`\n- `error(status, message)`: Envia resposta de erro padronizada\n- `header(name, value)`: Define cabeçalho HTTP customizado",
  "Pool": "### `Pool (db/postgres)`\nPool gerenciado de conexões com PostgreSQL.\n\n```flexlang\nlet db = Pool.new(config);\nlet users = db.query(\"SELECT * FROM users WHERE id = $1\", [id])?;\n```",
  "PoolConfig": "### `PoolConfig (db/postgres)`\nConfiguração do pool de conexões PostgreSQL.\n- `connection_string`: URL de conexão (`postgres://...`)\n- `max_open_conns`: Limite máximo de conexões ativas\n- `max_idle_conns`: Limite máximo de conexões em espera",
  "Channel": "### `Channel<T>`\nCanal de comunicação tipado para concorrência segura sem data races.\n\n```flexlang\nlet ch = Channel.new();\nch.send(dado);\nlet valor = ch.recv();\n```",
  "Result": "### `Result<T, E>`\nTipo funcional embutido para tratamento seguro de operações que podem falhar.\nVariantes: `Result.Ok(T)` e `Result.Err(E)`.\nSuporta desempacotamento e propagação direta com o operador `?`.",
  "Option": "### `Option<T>`\nTipo funcional embutido para valores opcionais (ausência segura de `null`/`nil`).\nVariantes: `Option.Some(T)` e `Option.None`.",
  "log": "### `log (core/log)`\nMódulo nativo de logs estruturados em formato JSON com mascaramento automático de campos sensíveis.\n\n```flexlang\nlog.info(\"Usuário autenticado\", { user_id: 123 });\nlog.error(\"Falha na transação\", { erro: err });\n```",
};

// --- Ciclo de Vida do Language Server ---

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", ":", '"', "/", "<", " "],
      },
      documentFormattingProvider: true,
      documentSymbolProvider: true,
      definitionProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ["(", ","],
      },
      codeActionProvider: true,
    },
  };
});

// --- Validação e Emissão de Diagnósticos em Tempo Real ---

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

documents.onDidClose((e) => {
  documentCache.delete(e.document.uri);
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

/**
 * Valida o documento executando o Lexer, Parser e TypeChecker da FlexLang.
 */
function validateTextDocument(textDocument: TextDocument): void {
  const text = textDocument.getText();
  const filePath = textDocument.uri.startsWith("file://")
    ? decodeURIComponent(textDocument.uri.replace("file://", ""))
    : textDocument.uri;

  const diagnostics: Diagnostic[] = [];
  const errors: FlexError[] = [];
  let ast: Stmt[] = [];

  try {
    // 1. Análise Léxica
    const lexer = new Lexer(text);
    const tokens = lexer.tokenize();

    // 2. Análise Sintática
    const parser = new Parser(tokens, filePath);
    ast = parser.parse();

    // 3. Análise Semântica e Verificação de Tipos
    const checker = new TypeChecker();
    checker.check(ast, filePath);
  } catch (err: any) {
    if (err instanceof FlexError) {
      errors.push(err);
    } else {
      // Captura erros genéricos de parsing ou lexer
      const msg: string = err?.message || String(err);
      const lineMatch = msg.match(/line\s+(\d+),\s*col(?:umn)?\s+(\d+)/i);
      if (lineMatch) {
        const line = Math.max(0, parseInt(lineMatch[1]!, 10) - 1);
        const col = Math.max(0, parseInt(lineMatch[2]!, 10) - 1);
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line, character: col },
            end: { line, character: col + 5 },
          },
          message: msg,
          source: "flexlang",
        });
      } else {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
          message: msg,
          source: "flexlang",
        });
      }
    }
  }

  // Converte erros estruturados FlexError em Diagnósticos LSP
  for (const err of errors) {
    const line = err.span ? Math.max(0, err.span.line - 1) : 0;
    const col = err.span ? Math.max(0, err.span.column - 1) : 0;
    const endLine = err.span ? Math.max(0, err.span.endLine - 1) : line;
    const endCol = err.span ? Math.max(0, err.span.endColumn - 1) : col + 1;

    let message = `[${err.code}] ${err.message}`;
    if (err.help) {
      message += `\n\n💡 Dica: ${err.help}`;
    }

    diagnostics.push({
      code: err.code,
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line, character: col },
        end: { line: endLine, character: endCol },
      },
      message,
      source: "flexlang",
    });
  }

  // Atualiza o cache do documento
  documentCache.set(textDocument.uri, { ast, errors });

  // Notifica o VSCode com a lista de diagnósticos
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// --- Provedor de Hover (Documentação Interativa) ---

connection.onHover((params): Hover | null => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const position = params.position;
    const word = getWordAtPosition(document, position);
    if (!word) return null;

    // 1. Verifica se é símbolo da Stdlib documentado
    if (STDLIB_DOCS[word]) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: STDLIB_DOCS[word],
        },
      };
    }

    // 2. Busca definições na AST atual
    const analysis = documentCache.get(params.textDocument.uri);
    if (analysis && analysis.ast) {
      for (const stmt of analysis.ast) {
        if (stmt.kind === "FunctionDeclaration" && stmt.name === word) {
          const params = stmt.parameters || [];
          const paramsStr = params
            .map((p) => `${p.isMut ? "mut " : ""}${p.name}: ${formatTypeNode(p.typeAnnotation)}`)
            .join(", ");
          const returnStr = stmt.returnType ? formatTypeNode(stmt.returnType) : "Void";
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`flexlang\nfunc ${stmt.name}(${paramsStr}) -> ${returnStr}\n\`\`\`\n\nFunção declarada no escopo local.`,
            },
          };
        }

        if (stmt.kind === "StructDeclaration" && stmt.name === word) {
          const props = stmt.properties || [];
          const fieldsStr = props
            .map((f) => `  ${f.name}: ${formatTypeNode(f.typeAnnotation)}`)
            .join(",\n");
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`flexlang\nstruct ${stmt.name} {\n${fieldsStr}\n}\n\`\`\`\n\nEstrutura de dados imutável por padrão.`,
            },
          };
        }

        if (stmt.kind === "EnumDeclaration" && stmt.name === word) {
          const variants = stmt.variants || [];
          const variantsStr = variants
            .map((v) => `  ${v.name}${v.payload && v.payload.length > 0 ? `(...)` : ""}`)
            .join(",\n");
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`flexlang\nenum ${stmt.name} {\n${variantsStr}\n}\n\`\`\`\n\nEnum com suporte a Pattern Matching exhaustivo.`,
            },
          };
        }

        if (stmt.kind === "TraitDeclaration" && stmt.name === word) {
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`flexlang\ntrait ${stmt.name}\n\`\`\`\n\nDefinição de interface/contrato de comportamento.`,
            },
          };
        }
      }
    }

    // 3. Palavras-chave da linguagem
    const KEYWORD_HOVERS: Record<string, string> = {
      "let": "**`let`**: Declara uma nova variável imutável por padrão.",
      "mut": "**`mut`**: Especifica mutabilidade explícita para variáveis ou parâmetros.",
      "scope": "**`scope`**: Bloco de concorrência estruturada. Aguarda o término de todas as tarefas filhas `spawn`.",
      "spawn": "**`spawn`**: Inicia uma green thread leve concorrente dentro de um `scope`.",
      "match": "**`match`**: Desestruturação e verificação exaustiva de padrões em variantes de enums.",
      "impl": "**`impl`**: Bloco de implementação de métodos ou conformance de Traits.",
      "trait": "**`trait`**: Declaração de abstração de comportamento.",
      "struct": "**`struct`**: Declaração de modelo de dados.",
      "func": "**`func`**: Declaração de função.",
      "break": "**`break`**: Interrompe imediatamente a execução do laço 'for' ou 'while' envolvente.",
      "continue": "**`continue`**: Avança para a próxima iteração do laço 'for' ou 'while' envolvente.",
      "print": "**`print`**: Imprime valores na saída padrão do sistema.",
    };

    if (KEYWORD_HOVERS[word]) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: KEYWORD_HOVERS[word],
        },
      };
    }

    return null;
  } catch {
    return null;
  }
});

// --- Provedor de Auto-complete (IntelliSense) ---

connection.onCompletion((params): CompletionItem[] => {
  try {
    const items: CompletionItem[] = [];

    // 1. Palavras-chave essenciais
    const keywords = [
      { label: "func", detail: "Declaração de função", kind: CompletionItemKind.Keyword },
      { label: "let", detail: "Declaração de variável imutável", kind: CompletionItemKind.Keyword },
      { label: "mut", detail: "Modificador de mutabilidade", kind: CompletionItemKind.Keyword },
      { label: "const", detail: "Declaração de constante", kind: CompletionItemKind.Keyword },
      { label: "struct", detail: "Declaração de estrutura", kind: CompletionItemKind.Keyword },
      { label: "impl", detail: "Bloco de implementação", kind: CompletionItemKind.Keyword },
      { label: "trait", detail: "Declaração de interface de trait", kind: CompletionItemKind.Keyword },
      { label: "enum", detail: "Declaração de enum com variantes", kind: CompletionItemKind.Keyword },
      { label: "match", detail: "Desestruturação exaustiva de padrão", kind: CompletionItemKind.Keyword },
      { label: "scope", detail: "Escopo de concorrência estruturada", kind: CompletionItemKind.Keyword },
      { label: "spawn", detail: "Gera tarefa concorrente em escopo", kind: CompletionItemKind.Keyword },
      { label: "import", detail: "Importação de módulos", kind: CompletionItemKind.Keyword },
      { label: "from", detail: "Cláusula de importação", kind: CompletionItemKind.Keyword },
      { label: "return", detail: "Retorna valor da função", kind: CompletionItemKind.Keyword },
      { label: "break", detail: "Interrompe execução do laço", kind: CompletionItemKind.Keyword },
      { label: "continue", detail: "Avança para próxima iteração", kind: CompletionItemKind.Keyword },
      { label: "if", detail: "Condicional", kind: CompletionItemKind.Keyword },
      { label: "else", detail: "Condicional alternativa", kind: CompletionItemKind.Keyword },
      { label: "while", detail: "Laço de repetição", kind: CompletionItemKind.Keyword },
      { label: "for", detail: "Laço de iteração", kind: CompletionItemKind.Keyword },
      { label: "in", detail: "Cláusula de iteração for", kind: CompletionItemKind.Keyword },
      { label: "print", detail: "Imprime na saída padrão", kind: CompletionItemKind.Function },
    ];

    for (const kw of keywords) {
      items.push(kw);
    }

    // 2. Tipos primitivos e embutidos
    const types = ["Int", "Float", "String", "Bool", "Void", "Result", "Option", "Channel", "Map"];
    for (const t of types) {
      items.push({
        label: t,
        kind: CompletionItemKind.Class,
        detail: `Tipo ${t} da FlexLang`,
      });
    }

    // 3. Módulos da biblioteca padrão
    const stdModules = [
      { label: "net/http", detail: "Módulo nativo de servidor e cliente HTTP" },
      { label: "db/postgres", detail: "Módulo nativo de conexão com banco de dados PostgreSQL" },
      { label: "core/log", detail: "Módulo nativo de logging estruturado JSON" },
    ];
    for (const mod of stdModules) {
      items.push({
        label: `"${mod.label}"`,
        kind: CompletionItemKind.Module,
        detail: mod.detail,
      });
    }

    // 4. Símbolos declarados na AST do documento
    const analysis = documentCache.get(params.textDocument.uri);
    if (analysis && analysis.ast) {
      for (const stmt of analysis.ast) {
        if (stmt.kind === "FunctionDeclaration") {
          items.push({
            label: stmt.name,
            kind: CompletionItemKind.Function,
            detail: `func ${stmt.name}(...)`,
          });
        } else if (stmt.kind === "StructDeclaration") {
          items.push({
            label: stmt.name,
            kind: CompletionItemKind.Struct,
            detail: `struct ${stmt.name}`,
          });
        } else if (stmt.kind === "EnumDeclaration") {
          items.push({
            label: stmt.name,
            kind: CompletionItemKind.Enum,
            detail: `enum ${stmt.name}`,
          });
          const variants = stmt.variants || [];
          for (const v of variants) {
            items.push({
              label: `${stmt.name}.${v.name}`,
              kind: CompletionItemKind.EnumMember,
              detail: `Variante de ${stmt.name}`,
            });
          }
        } else if (stmt.kind === "TraitDeclaration") {
          items.push({
            label: stmt.name,
            kind: CompletionItemKind.Interface,
            detail: `trait ${stmt.name}`,
          });
        }
      }
    }

    return items;
  } catch {
    return [];
  }
});

// --- Provedor de Formatação de Documento ---

connection.onDocumentFormatting((params): TextEdit[] => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const text = document.getText();
    const indentSize = params.options.tabSize ?? 4;
    const useTabs = !params.options.insertSpaces;

    const docFormatter = new FlexFormatter({ indentSize, useTabs });
    const formatted = docFormatter.format(text);

    // Substituição completa do conteúdo do documento
    const fullRange: Range = {
      start: { line: 0, character: 0 },
      end: { line: document.lineCount, character: 0 },
    };

    return [TextEdit.replace(fullRange, formatted)];
  } catch {
    return [];
  }
});

// --- Provedor de Símbolos do Documento (Outline / Breadcrumbs) ---

connection.onDocumentSymbol((params): DocumentSymbol[] => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const analysis = documentCache.get(params.textDocument.uri);
    if (!analysis || !analysis.ast) return [];

    const symbols: DocumentSymbol[] = [];

    for (const stmt of analysis.ast) {
      if (stmt.kind === "FunctionDeclaration") {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const endLine = stmt.span ? Math.max(0, stmt.span.endLine - 1) : line;
        symbols.push({
          name: stmt.name,
          kind: SymbolKind.Function,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, stmt.name.length),
          detail: `func ${stmt.name}()`,
        });
      } else if (stmt.kind === "StructDeclaration") {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const endLine = stmt.span ? Math.max(0, stmt.span.endLine - 1) : line;
        symbols.push({
          name: stmt.name,
          kind: SymbolKind.Struct,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, stmt.name.length),
          detail: `struct ${stmt.name}`,
        });
      } else if (stmt.kind === "EnumDeclaration") {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const endLine = stmt.span ? Math.max(0, stmt.span.endLine - 1) : line;
        symbols.push({
          name: stmt.name,
          kind: SymbolKind.Enum,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, stmt.name.length),
          detail: `enum ${stmt.name}`,
        });
      } else if (stmt.kind === "TraitDeclaration") {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const endLine = stmt.span ? Math.max(0, stmt.span.endLine - 1) : line;
        symbols.push({
          name: stmt.name,
          kind: SymbolKind.Interface,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, stmt.name.length),
          detail: `trait ${stmt.name}`,
        });
      } else if (stmt.kind === "ImplDeclaration") {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const endLine = stmt.span ? Math.max(0, stmt.span.endLine - 1) : line;
        const name = stmt.traitName ? `impl ${stmt.traitName} for ${stmt.structName}` : `impl ${stmt.structName}`;
        symbols.push({
          name,
          kind: SymbolKind.Class,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, name.length),
          detail: name,
        });
      }
    }

    return symbols;
  } catch {
    return [];
  }
});

// --- Provedor de Definição (Go to Definition) ---

connection.onDefinition((params): Definition | null => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const word = getWordAtPosition(document, params.position);
    if (!word) return null;

    const currentFilePath = document.uri.startsWith("file://")
      ? decodeURIComponent(document.uri.replace("file://", ""))
      : document.uri;

    const analysis = documentCache.get(params.textDocument.uri);
    if (!analysis || !analysis.ast) return null;

    // 1. Busca no próprio arquivo atual
    for (const stmt of analysis.ast) {
      if (
        (stmt.kind === "FunctionDeclaration" && stmt.name === word) ||
        (stmt.kind === "StructDeclaration" && stmt.name === word) ||
        (stmt.kind === "EnumDeclaration" && stmt.name === word) ||
        (stmt.kind === "TraitDeclaration" && stmt.name === word)
      ) {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const col = stmt.span ? Math.max(0, stmt.span.column - 1) : 0;
        return Location.create(params.textDocument.uri, Range.create(line, col, line, col + word.length));
      }

      // 2. Se for um símbolo importado de módulo local, resolve o arquivo de destino
      if (stmt.kind === "ImportDeclaration") {
        const imports = stmt.imports || [];
        if (imports.includes(word) && isLocalModule(stmt.moduleName)) {
          try {
            const resolvedPath = resolveModuleFilePath(currentFilePath, stmt.moduleName);
            const targetUri = "file://" + resolvedPath;
            return Location.create(targetUri, Range.create(0, 0, 0, 0));
          } catch {
            // Ignora caso módulo não seja encontrado
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
});

// --- Provedor de Signature Help ---

connection.onSignatureHelp((params): SignatureHelp | null => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    const beforeText = text.slice(0, offset);

    const callMatch = beforeText.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^()]*)$/);
    if (!callMatch) return null;

    const funcName = callMatch[1];
    const argsText = callMatch[2] || "";
    const activeParameter = (argsText.match(/,/g) || []).length;

    const analysis = documentCache.get(params.textDocument.uri);
    if (analysis && analysis.ast) {
      for (const stmt of analysis.ast) {
        if (stmt.kind === "FunctionDeclaration" && stmt.name === funcName) {
          const params = stmt.parameters || [];
          const paramsInfo: ParameterInformation[] = params.map((p) => ({
            label: `${p.isMut ? "mut " : ""}${p.name}: ${formatTypeNode(p.typeAnnotation)}`,
          }));
          const sig: SignatureInformation = {
            label: `func ${stmt.name}(${paramsInfo.map((p) => p.label).join(", ")}) -> ${stmt.returnType ? formatTypeNode(stmt.returnType) : "Void"}`,
            parameters: paramsInfo,
            documentation: "Declaração de função FlexLang.",
          };
          return {
            signatures: [sig],
            activeSignature: 0,
            activeParameter,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
});

// --- Provedor de Code Actions (Quick Fixes) ---

connection.onCodeAction((params): CodeAction[] => {
  try {
    const actions: CodeAction[] = [];
    const document = documents.get(params.textDocument.uri);
    if (!document) return actions;

    for (const diagnostic of params.context.diagnostics) {
      // Sugestão de tornar mutável caso erro de reatribuição imutável
      if (diagnostic.code === "E2001" || diagnostic.message.includes("is not mutable")) {
        const fix = CodeAction.create("Adicionar modificador 'mut'", CodeActionKind.QuickFix);
        fix.diagnostics = [diagnostic];
        actions.push(fix);
      }
    }

    return actions;
  } catch {
    return [];
  }
});

// --- Funções Auxiliares ---

function getWordAtPosition(document: TextDocument, position: Position): string | null {
  const text = document.getText();
  const line = text.split(/\r?\n/)[position.line];
  if (!line) return null;

  let start = position.character;
  while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1]!)) {
    start--;
  }

  let end = position.character;
  while (end < line.length && /[a-zA-Z0-9_]/.test(line[end]!)) {
    end++;
  }

  if (start === end) return null;
  return line.slice(start, end);
}

function formatTypeNode(typeNode?: TypeNode): string {
  if (!typeNode) return "Void";
  if (typeNode.kind === "NamedTypeNode") {
    return typeNode.name;
  }
  if (typeNode.kind === "GenericTypeNode") {
    const args = (typeNode.typeArguments || []).map(formatTypeNode).join(", ");
    return `${typeNode.name}<${args}>`;
  }
  if (typeNode.kind === "ArrayTypeNode") {
    return `[${formatTypeNode(typeNode.elementType)}]`;
  }
  return "Any";
}

// Inicializa a escuta de documentos e conexão
documents.listen(connection);
connection.listen();
