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
  InsertTextFormat,
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
  ConstDeclaration,
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
  // net/http
  "Server": "### `Server (net/http)`\nServidor HTTP nativo de alto desempenho da FlexLang com suporte a middlewares, rotas dinâmicas e uploads de arquivos.\n\n```flexlang\nlet mut server = Server.new(\":3000\", config);\nserver.get(\"/users/:id\", |req, res| {\n    res.json({ id: req.param(\"id\") });\n});\nserver.start();\n```",
  "ServerConfig": "### `ServerConfig (net/http)`\nConfiguração de execução do servidor HTTP.\n- `read_timeout`: Tempo limite em milissegundos para leitura de requests.\n- `max_body_size`: Tamanho máximo do corpo da requisição em bytes.",
  "CorsConfig": "### `CorsConfig (net/http)`\nConfiguração de Cross-Origin Resource Sharing (CORS).\n- `allow_origins`: Lista de origens autorizadas\n- `allow_methods`: Lista de verbos HTTP autorizados\n- `allow_headers`: Cabeçalhos HTTP permitidos\n- `max_age`: Tempo de cache do Preflight em segundos",
  "Request": "### `Request (net/http)`\nObjeto que encapsula a requisição HTTP recebida no servidor.\n- `param(name)`: Lê parâmetro de rota dinâmico (`:id`)\n- `param_int(name)`: Lê parâmetro de rota como inteiro\n- `query(name)`: Lê parâmetro de query string\n- `query_int(name)`: Lê query parameter como inteiro\n- `header(name)`: Lê cabeçalho HTTP case-insensitive\n- `headers()`: Retorna mapa de todos os cabeçalhos\n- `form_value(name)`: Extrai campo de texto multipart/urlencoded (RFC-046)\n- `form_file(name)`: Extrai arquivo `UploadedFile` recebido via multipart (RFC-046)\n- `json()`: Faz parsing seguro do payload JSON",
  "UploadedFile": "### `UploadedFile (net/http)`\nRepresenta um arquivo binário/texto recebido via `multipart/form-data` (RFC-046).\n- `filename`: Nome original do arquivo\n- `content_type`: Tipo MIME do arquivo\n- `size`: Tamanho em bytes\n- `content`: Conteúdo do arquivo",
  "Response": "### `Response (net/http)`\nObjeto para construção e envio da resposta HTTP.\n- `status(code)`: Define código de status HTTP\n- `json(data)`: Envia payload JSON com cabeçalho `application/json`\n- `send_string(text)`: Envia texto plano\n- `error(status, message)`: Envia resposta de erro padronizada\n- `header(name, value)`: Define cabeçalho HTTP customizado",
  "MultipartForm": "### `MultipartForm (net/http)`\nEstrutura para montagem e envio de formulários multipart e arquivos binários no cliente HTTP.",
  "Client": "### `Client (net/http)`\nCliente HTTP nativo com suporte a pooling de conexões, timeouts e TLS.\n\n```flexlang\nlet client = Client.new(ClientConfig { timeout_ms: 5000 });\nlet res = client.get(\"https://api.exemplo.com/dados\")?;\nlet body = res.json()?;\n```",

  // db/postgres
  "Pool": "### `Pool (db/postgres)`\nPool gerenciado de conexões com PostgreSQL de alta concorrência.\n\n```flexlang\nlet db = Pool.new(config);\nlet users = db.query(\"SELECT * FROM users WHERE id = $1\", [id])?;\n```",
  "PoolConfig": "### `PoolConfig (db/postgres)`\nConfiguração do pool de conexões PostgreSQL.\n- `connection_string`: URL de conexão (`postgres://...`)\n- `max_open_conns`: Limite máximo de conexões ativas\n- `max_idle_conns`: Limite máximo de conexões em espera",

  // storage/redis
  "Redis": "### `Redis (storage/redis)`\nDriver nativo Redis com pool assíncrono e suporte a distributed locks com renovação automática.\n\n```flexlang\nlet mut client = Redis.connect(RedisConfig { host: \"localhost\", port: 6379 })?;\nclient.set(\"chave\", \"valor\", 60)?;\nlet val = client.get(\"chave\")?;\n```",
  "RedisLock": "### `RedisLock (storage/redis)`\nLock distribuído implementado via scripts Lua atômicos com renovação automática via heartbeat.\n\n```flexlang\nlet lock = client.acquire_lock(\"recurso:123\", 10000)?;\n// processamento crítico...\nlock.release()?;\n```",

  // config/dotenv
  "dotenv": "### `dotenv (config/dotenv)`\nCarregamento e injeção automática de arquivos de ambiente (`.env`, `.env.local`).\n\n```flexlang\nimport { dotenv } from \"config/dotenv\";\ndotenv.load();\nlet port = dotenv.get_or(\"PORT\", \"8080\");\n```",

  // encoding
  "json": "### `json (encoding)`\nSerialização e desserialização JSON de alto desempenho com preservação de tipos.\n\n```flexlang\nimport { json } from \"encoding\";\nlet str = json.stringify(dados);\nlet parsed = json.parse(str)?;\n```",
  "base64": "### `base64 (encoding)`\nCodificação e decodificação Base64 segura e compatível com URLs (RFC 4648).\n\n```flexlang\nimport { base64 } from \"encoding\";\nlet encoded = base64.encode(\"texto\");\nlet decoded = base64.decode(encoded)?;\n```",
  "hex": "### `hex (encoding)`\nCodificação e decodificação de strings hexadecimais.\n\n```flexlang\nimport { hex } from \"encoding\";\nlet encoded = hex.encode(\"binario\");\n```",

  // std/fs & std/path
  "fs": "### `fs (std/fs)`\nOperações de sistema de arquivos síncronas e atômicas com tratamento funcional de erro.\n\n```flexlang\nimport { fs } from \"std/fs\";\nlet content = fs.read_to_string(\"./config.json\")?;\nfs.write_file(\"./log.txt\", \"dados\")?;\n```",
  "path": "### `path (std/path)`\nManipulação agnóstica de caminhos de arquivos e diretórios.\n\n```flexlang\nimport { path } from \"std/path\";\nlet full = path.join([\"src\", \"modules\", \"main.flex\"]);\n```",

  // crypto/jwt
  "jwt": "### `jwt (crypto/jwt)`\nAssinatura, verificação e parsing de JSON Web Tokens (HS256, RS256).\n\n```flexlang\nimport { jwt } from \"crypto/jwt\";\nlet token = jwt.sign({ sub: \"123\" }, \"secret_key\", 3600)?;\nlet claims = jwt.verify(token, \"secret_key\")?;\n```",

  // data/validator
  "Validator": "### `Validator (data/validator)`\nMotor de validação declarativa fluente para structs e payloads.\n\n```flexlang\nimport { Validator } from \"data/validator\";\nlet result = Validator.new()\n    .required(\"email\")\n    .email(\"email\")\n    .min_length(\"senha\", 8)\n    .validate(payload);\n```",

  // core/resilience
  "CircuitBreaker": "### `CircuitBreaker (core/resilience)`\nPadrão Circuit Breaker com três estados (Closed, Open, Half-Open) para isolamento de falhas em cascata.\n\n```flexlang\nimport { CircuitBreaker } from \"core/resilience\";\nlet cb = CircuitBreaker.new(CircuitBreakerConfig { max_failures: 5, reset_timeout_ms: 10000 });\nlet res = cb.call(|| { operacao_arriscada() })?;\n```",
  "Retry": "### `Retry (core/resilience)`\nMecanismo de retentativas com backoff exponencial e jitter determinístico.\n\n```flexlang\nimport { Retry } from \"core/resilience\";\nlet retry = Retry.new(RetryConfig { max_attempts: 3, base_delay_ms: 200 });\nlet res = retry.run(|| { requisicao_externa() })?;\n```",

  // core/telemetry
  "Counter": "### `Counter (core/telemetry)`\nMétrica monotônica incremental compatível com Prometheus e OpenTelemetry.\n\n```flexlang\nimport { Counter } from \"core/telemetry\";\nlet c = Counter.new(\"http_requests_total\", \"Total de requests recebidas\");\nc.inc();\n```",
  "Histogram": "### `Histogram (core/telemetry)`\nMétrica de distribuição e latência em buckets configuráveis.\n\n```flexlang\nimport { Histogram } from \"core/telemetry\";\nlet h = Histogram.new(\"http_request_duration_seconds\", [0.01, 0.05, 0.1, 0.5, 1.0]);\nh.observe(0.042);\n```",
  "Tracer": "### `Tracer (core/telemetry)`\nRastreamento distribuído com spans, trace context W3C e injeção automática de headers.\n\n```flexlang\nimport { Tracer } from \"core/telemetry\";\nlet span = Tracer.start_span(\"process_payment\");\n// trabalho...\nspan.end();\n```",

  // mq/kafka
  "Producer": "### `Producer (mq/kafka)`\nProdutor Kafka nativo de alta taxa de transferência e entrega garantida (At-Least-Once / Idempotent).\n\n```flexlang\nimport { Producer } from \"mq/kafka\";\nlet p = Producer.new(ProducerConfig { brokers: [\"localhost:9092\"] });\np.send(\"pedidos\", \"chave-1\", payload)?;\n```",
  "Consumer": "### `Consumer (mq/kafka)`\nConsumidor Kafka organizado por consumer groups com auto-commit e gerenciamento de offsets.\n\n```flexlang\nimport { Consumer } from \"mq/kafka\";\nlet c = Consumer.new(ConsumerConfig { brokers: [\"localhost:9092\"], group_id: \"pedidos-worker\" });\nc.subscribe(\"pedidos\", |msg| {\n    print(msg.value);\n});\n```",

  // std/testing
  "assert_eq": "### `assert_eq(actual, expected, message?) (std/testing)`\nVerifica se dois valores são estritamente iguais. Em caso de discrepância, interrompe a execução do teste e relata a diferença detalhada.",
  "assert_ne": "### `assert_ne(actual, expected, message?) (std/testing)`\nVerifica se dois valores são diferentes.",
  "assert_true": "### `assert_true(condition, message?) (std/testing)`\nValida se a expressão avaliada é verdadeira (`true`).",
  "assert_false": "### `assert_false(condition, message?) (std/testing)`\nValida se a expressão avaliada é falsa (`false`).",
  "assert_ok": "### `assert_ok(result, message?) -> T (std/testing)`\nAssegura que o valor é `Result.Ok(T)` e retorna diretamente o payload desempacotado `T` para encadeamento.",
  "assert_err": "### `assert_err(result, message?) -> E (std/testing)`\nAssegura que o valor é `Result.Err(E)` e retorna diretamente a mensagem de erro `E`.",
  "assert_some": "### `assert_some(option, message?) -> T (std/testing)`\nAssegura que o valor é `Option.Some(T)` e retorna diretamente o valor `T`.",
  "assert_none": "### `assert_none(option, message?) (std/testing)`\nAssegura que o valor é `Option.None`.",

  // finance/idempotency
  "IdempotencyEngine": "### `IdempotencyEngine (finance/idempotency)`\nMotor de garantia de processamento exatamente uma vez (Exactly-Once Semantics) para operações financeiras.\n\n```flexlang\nimport { IdempotencyEngine } from \"finance/idempotency\";\nlet engine = IdempotencyEngine.new(storage_redis);\nlet result = engine.process(\"pix:tx_12345\", || {\n    executa_transferencia()\n})?;\n```",

  // std/regex
  "Regex": "### `Regex (std/regex)`\nMotor de expressões regulares determinístico com tempo linear O(N) e imune a ataques ReDoS (Baseado no motor RE2).\n\n```flexlang\nimport { Regex } from \"std/regex\";\nlet re = Regex.compile(\"^[a-zA-Z0-9_]+$\")?;\nlet matches = re.is_match(\"usuario_123\")?;\n```",

  // core/scheduler
  "Scheduler": "### `Scheduler (core/scheduler)`\nAgendador nativo de tarefas recorrentes em background com suporte a expressões Cron padrão (5/6 campos).\n\n```flexlang\nimport { Scheduler } from \"core/scheduler\";\nlet mut s = Scheduler.new();\ns.cron(\"0 * * * *\", || {\n    rotina_limpeza();\n});\ns.start();\n```",

  // math/decimal
  "Decimal": "### `Decimal (math/decimal)`\nTipo numérico financeiro com precisão arbitrária exata, imune a erros de ponto flutuante IEEE 754.\n\n```flexlang\nimport { Decimal } from \"math/decimal\";\nlet a = Decimal.from_string(\"10.50\")?;\nlet b = Decimal.from_string(\"2.25\")?;\nlet total = a.add(b)?;\n```",

  // core/time
  "Time": "### `Time (core/time)`\nRepresentação de instantes temporais com precisão de nanossegundos e conversão UTC.\n\n```flexlang\nimport { Time, Duration } from \"core/time\";\nlet agora = Time.now();\nlet futuro = agora.add(Duration.from_secs(60));\n```",

  // crypto
  "crypto": "### `crypto`\nFunções criptográficas de hashing (SHA256, MD5, Bcrypt), HMAC e geração de UUID v4 seguro.\n\n```flexlang\nimport { hash, uuid, hmac } from \"crypto\";\nlet id = uuid.v4();\nlet hash_pass = hash.bcrypt(\"senha123\")?;\n```",

  // os/env
  "env": "### `env (os/env)`\nLeitura de variáveis de ambiente do sistema operacional.\n\n```flexlang\nimport { env } from \"os/env\";\nlet db_host = env.get_or(\"DB_HOST\", \"localhost\");\nlet port = env.require(\"PORT\")?;\n```",

  // Tipos fundamentais
  "Channel": "### `Channel<T>`\nCanal de comunicação tipado para concorrência segura sem data races.\n\n```flexlang\nlet ch = Channel.new();\nch.send(dado);\nlet valor = ch.recv();\n```",
  "Result": "### `Result<T, E>`\nTipo funcional embutido para tratamento seguro de operações que podem falhar.\nVariantes: `Result.Ok(T)` e `Result.Err(E)`.\nSuporta desempacotamento e propagação direta com o operador `?` ou bloco de fallback `catch`.",
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
        triggerCharacters: [".", ":", '"', "/", "<", " ", "#", "["],
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
          const attrsStr = stmt.attributes && stmt.attributes.length > 0 
            ? stmt.attributes.map(a => `#[${a.name}]`).join("\n") + "\n"
            : "";
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`flexlang\n${attrsStr}func ${stmt.name}(${paramsStr}) -> ${returnStr}\n\`\`\`\n\nFunção declarada no escopo local.`,
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

        if (stmt.kind === "ConstDeclaration" && stmt.name === word) {
          return {
            contents: {
              kind: MarkupKind.Markdown,
              value: `\`\`\`flexlang\nconst ${stmt.name}\n\`\`\`\n\nConstante de nível de módulo imutável e estática.`,
            },
          };
        }
      }
    }

    // 3. Palavras-chave da linguagem
    const KEYWORD_HOVERS: Record<string, string> = {
      "let": "**`let`**: Declara uma nova variável imutável por padrão no escopo local.",
      "mut": "**`mut`**: Especifica mutabilidade explícita para variáveis ou parâmetros.",
      "const": "**`const`**: Declara uma constante imutável estática de nível de módulo.",
      "scope": "**`scope`**: Bloco de concorrência estruturada. Aguarda o término de todas as green threads filhas `spawn`.",
      "spawn": "**`spawn`**: Inicia uma green thread leve e concorrente dentro de um `scope`.",
      "match": "**`match`**: Desestruturação e verificação exaustiva de padrões em variantes de enums.",
      "catch": "**`catch`**: Bloco de tratamento e fallback inline de operações que retornam `Result<T, E>`.",
      "impl": "**`impl`**: Bloco de implementação de métodos ou conformance de Traits para uma Struct.",
      "trait": "**`trait`**: Declaração de abstração e contrato de comportamento.",
      "struct": "**`struct`**: Declaração de modelo de dados estruturado.",
      "func": "**`func`**: Declaração de função.",
      "return": "**`return`**: Retorna um valor da função envolvente.",
      "break": "**`break`**: Interrompe imediatamente a execução do laço 'for' ou 'while' envolvente.",
      "continue": "**`continue`**: Avança para a próxima iteração do laço 'for' ou 'while' envolvente.",
      "if": "**`if`**: Estrutura condicional de controle de fluxo.",
      "else": "**`else`**: Ramo alternativo para estruturas condicionais `if`.",
      "for": "**`for`**: Laço de repetição e iteração sobre coleções (`Array`, `Map`, `Range`).",
      "in": "**`in`**: Cláusula de iteração utilizada no laço `for`.",
      "while": "**`while`**: Laço de repetição baseado em uma condição booleana.",
      "import": "**`import`**: Importa símbolos de módulos locais ou da biblioteca padrão.",
      "from": "**`from`**: Cláusula de origem da declaração de `import`.",
      "self": "**`self`**: Referência à instância atual da estrutura dentro de um método `impl`.",
      "print": "**`print`**: Imprime valores na saída padrão do sistema.",
      "true": "**`true`**: Literal booleano de valor verdadeiro.",
      "false": "**`false`**: Literal booleano de valor falso.",
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
      { label: "const", detail: "Declaração de constante de módulo", kind: CompletionItemKind.Keyword },
      { label: "struct", detail: "Declaração de estrutura", kind: CompletionItemKind.Keyword },
      { label: "impl", detail: "Bloco de implementação", kind: CompletionItemKind.Keyword },
      { label: "trait", detail: "Declaração de interface de trait", kind: CompletionItemKind.Keyword },
      { label: "enum", detail: "Declaração de enum com variantes", kind: CompletionItemKind.Keyword },
      { label: "match", detail: "Desestruturação exaustiva de padrão", kind: CompletionItemKind.Keyword },
      { label: "catch", detail: "Tratamento inline de erro com fallback", kind: CompletionItemKind.Keyword },
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
      { label: "self", detail: "Referência à instância atual", kind: CompletionItemKind.Keyword },
      { label: "true", detail: "Booleano verdadeiro", kind: CompletionItemKind.Keyword },
      { label: "false", detail: "Booleano falso", kind: CompletionItemKind.Keyword },
      { label: "print", detail: "Imprime na saída padrão", kind: CompletionItemKind.Function },
    ];

    for (const kw of keywords) {
      items.push(kw);
    }

    // 2. Tipos primitivos, embutidos e stdlib
    const types = [
      { label: "Int", detail: "Inteiro de 64 bits", kind: CompletionItemKind.Class },
      { label: "Float", detail: "Ponto flutuante de 64 bits", kind: CompletionItemKind.Class },
      { label: "String", detail: "Cadeia de caracteres UTF-8", kind: CompletionItemKind.Class },
      { label: "Bool", detail: "Booleano (true / false)", kind: CompletionItemKind.Class },
      { label: "Void", detail: "Tipo unitário vazio", kind: CompletionItemKind.Class },
      { label: "Result", detail: "Tipo funcional Result<T, E>", kind: CompletionItemKind.Class },
      { label: "Option", detail: "Tipo funcional Option<T>", kind: CompletionItemKind.Class },
      { label: "Channel", detail: "Canal de comunicação concorrente", kind: CompletionItemKind.Class },
      { label: "Decimal", detail: "Numérico de precisão exata (math/decimal)", kind: CompletionItemKind.Class },
      { label: "HashMap", detail: "Mapa associativo chave-valor", kind: CompletionItemKind.Class },
      { label: "Server", detail: "Servidor REST HTTP (net/http)", kind: CompletionItemKind.Class },
      { label: "Request", detail: "Requisição HTTP (net/http)", kind: CompletionItemKind.Class },
      { label: "Response", detail: "Resposta HTTP (net/http)", kind: CompletionItemKind.Class },
      { label: "UploadedFile", detail: "Arquivo recebido via upload multipart (net/http)", kind: CompletionItemKind.Class },
      { label: "MultipartForm", detail: "Formulário de upload multipart (net/http)", kind: CompletionItemKind.Class },
      { label: "Client", detail: "Cliente HTTP (net/http)", kind: CompletionItemKind.Class },
      { label: "Pool", detail: "Pool de conexões PostgreSQL (db/postgres)", kind: CompletionItemKind.Class },
      { label: "RedisClient", detail: "Cliente de armazenamento Redis (storage/redis)", kind: CompletionItemKind.Class },
      { label: "RedisLock", detail: "Lock distribuído atômico (storage/redis)", kind: CompletionItemKind.Class },
      { label: "Validator", detail: "Validador declarativo fluente (data/validator)", kind: CompletionItemKind.Class },
      { label: "CircuitBreaker", detail: "Disjuntor de resiliência (core/resilience)", kind: CompletionItemKind.Class },
      { label: "Retry", detail: "Mecanismo de retentativas com backoff (core/resilience)", kind: CompletionItemKind.Class },
      { label: "RateLimiter", detail: "Limitador de taxa token bucket (core/resilience)", kind: CompletionItemKind.Class },
      { label: "Counter", detail: "Métrica monotônica de contagem (core/telemetry)", kind: CompletionItemKind.Class },
      { label: "Histogram", detail: "Métrica de distribuição de latência (core/telemetry)", kind: CompletionItemKind.Class },
      { label: "Tracer", detail: "Rastreador distribuído OpenTelemetry (core/telemetry)", kind: CompletionItemKind.Class },
      { label: "Producer", detail: "Produtor de mensagens Kafka (mq/kafka)", kind: CompletionItemKind.Class },
      { label: "Consumer", detail: "Consumidor de mensagens Kafka (mq/kafka)", kind: CompletionItemKind.Class },
      { label: "IdempotencyEngine", detail: "Motor de idempotência Exactly-Once (finance/idempotency)", kind: CompletionItemKind.Class },
      { label: "Regex", detail: "Expressões regulares RE2 seguras (std/regex)", kind: CompletionItemKind.Class },
      { label: "Scheduler", detail: "Agendador de tarefas cron (core/scheduler)", kind: CompletionItemKind.Class },
      { label: "Time", detail: "Instante temporal e manipulação (core/time)", kind: CompletionItemKind.Class },
      { label: "Duration", detail: "Duração temporal (core/time)", kind: CompletionItemKind.Class },
    ];

    for (const t of types) {
      items.push(t);
    }

    // 3. Módulos da biblioteca padrão
    const stdModules = [
      { label: "net/http", detail: "Servidores e clientes HTTP REST de alto desempenho" },
      { label: "config/dotenv", detail: "Carregamento e injeção automática de arquivos .env" },
      { label: "encoding", detail: "Serialização e decodificação JSON, Base64 e Hex" },
      { label: "std/fs", detail: "Operações no sistema de arquivos local" },
      { label: "std/path", detail: "Manipulação de caminhos de arquivos e diretórios" },
      { label: "crypto/jwt", detail: "Assinatura e validação de tokens JWT" },
      { label: "storage/redis", detail: "Driver nativo Redis e locks distribuídos" },
      { label: "db/postgres", detail: "Pool gerenciado de conexões PostgreSQL" },
      { label: "math/decimal", detail: "Aritmética financeira exata de precisão arbitrária" },
      { label: "data/validator", detail: "Validação declarativa fluente de payloads" },
      { label: "core/resilience", detail: "Circuit Breaker, Retry e Rate Limiter" },
      { label: "core/telemetry", detail: "Métricas Prometheus e Rastreamento OpenTelemetry" },
      { label: "mq/kafka", detail: "Mensageria e streaming de eventos Kafka" },
      { label: "std/testing", detail: "Framework de testes unitários e asserções" },
      { label: "finance/idempotency", detail: "Motor de idempotência Exactly-Once" },
      { label: "std/regex", detail: "Expressões regulares determinísticas RE2" },
      { label: "core/scheduler", detail: "Agendador de tarefas em background e cron" },
      { label: "core/time", detail: "Manipulação de datas, horas e durações" },
      { label: "crypto", detail: "Criptografia, hashing e UUIDs seguros" },
      { label: "os/env", detail: "Variáveis de ambiente do sistema operacional" },
      { label: "core/log", detail: "Logging estruturado JSON com mascaramento" },
    ];

    for (const mod of stdModules) {
      items.push({
        label: `"${mod.label}"`,
        kind: CompletionItemKind.Module,
        detail: mod.detail,
      });
    }

    // 4. Asserções e Builtins
    const builtins = [
      { label: "assert_eq", detail: "assert_eq(actual, expected, msg?)", kind: CompletionItemKind.Function },
      { label: "assert_ne", detail: "assert_ne(actual, expected, msg?)", kind: CompletionItemKind.Function },
      { label: "assert_true", detail: "assert_true(cond, msg?)", kind: CompletionItemKind.Function },
      { label: "assert_false", detail: "assert_false(cond, msg?)", kind: CompletionItemKind.Function },
      { label: "assert_ok", detail: "assert_ok(result, msg?) -> T", kind: CompletionItemKind.Function },
      { label: "assert_err", detail: "assert_err(result, msg?) -> E", kind: CompletionItemKind.Function },
      { label: "assert_some", detail: "assert_some(option, msg?) -> T", kind: CompletionItemKind.Function },
      { label: "assert_none", detail: "assert_none(option, msg?)", kind: CompletionItemKind.Function },
      { label: "parse_int", detail: "parse_int(str) -> Result<Int, String>", kind: CompletionItemKind.Function },
      { label: "parse_float", detail: "parse_float(str) -> Result<Float, String>", kind: CompletionItemKind.Function },
    ];

    for (const b of builtins) {
      items.push(b);
    }

    // 5. Atributos da linguagem
    items.push({
      label: "#[test]",
      detail: "Marca função como teste unitário (RFC-041)",
      kind: CompletionItemKind.Snippet,
      insertText: "#[test]\nfunc test_${1:feature}() {\n\t$0\n}",
      insertTextFormat: InsertTextFormat.Snippet,
    });

    // 6. Símbolos declarados na AST do documento
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
        } else if (stmt.kind === "ConstDeclaration") {
          items.push({
            label: stmt.name,
            kind: CompletionItemKind.Constant,
            detail: `const ${stmt.name}`,
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
        const isTest = (stmt.attributes || []).some(a => a.name === "test") || stmt.name.startsWith("test_");
        symbols.push({
          name: stmt.name,
          kind: isTest ? SymbolKind.Method : SymbolKind.Function,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, stmt.name.length),
          detail: isTest ? `#[test] func ${stmt.name}()` : `func ${stmt.name}()`,
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
      } else if (stmt.kind === "ConstDeclaration") {
        const line = stmt.span ? Math.max(0, stmt.span.line - 1) : 0;
        const endLine = stmt.span ? Math.max(0, stmt.span.endLine - 1) : line;
        symbols.push({
          name: stmt.name,
          kind: SymbolKind.Constant,
          range: Range.create(line, 0, endLine, 0),
          selectionRange: Range.create(line, 0, line, stmt.name.length),
          detail: `const ${stmt.name}`,
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
        (stmt.kind === "TraitDeclaration" && stmt.name === word) ||
        (stmt.kind === "ConstDeclaration" && stmt.name === word)
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
      if (diagnostic.code === "E2001" || diagnostic.message.includes("is not mutable") || diagnostic.code === "E3001") {
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
