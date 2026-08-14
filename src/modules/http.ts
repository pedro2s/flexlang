import * as http from "http";
import type { Interpreter } from "../interpreter";
import { optionNone, optionSome, resultErr, resultOk } from "../stdlib";
import { NATIVE_TAG, type NativeModule } from "./types";

const DEFAULT_READ_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_BODY_SIZE = 1_000_000; // 1 MB

const INT_PATTERN = /^-?\d+$/;

/** `undefined`/ausente/≤0 caem no default — mesma convenção usada no lado Go, onde
 * um campo de `ServerConfig` omitido em Go vale zero (não haveria como distinguir
 * "não informado" de "informado como 0"). Mantém os dois modos idênticos. */
function positiveOr(value: unknown, fallback: number): number {
  return typeof value === "number" && value > 0 ? value : fallback;
}

/** Segmentos não vazios de um path: `"/users/:id"` -> `["users", ":id"]`. Barra
 * dupla ou final é tolerada (vira o mesmo conjunto de segmentos) — ver limitação
 * conhecida no RFC quanto a paths com barra final. */
function pathSegments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

interface CompiledRoute {
  segments: string[];
  handler: unknown;
}

/** Casamento por segmento: `:nome` é wildcard nomeado, o resto precisa ser igual.
 * Aridade diferente de segmentos nunca casa (sem prefixo/wildcard múltiplo). */
function matchRoute(route: CompiledRoute, requestSegments: string[]): Record<string, string> | null {
  if (route.segments.length !== requestSegments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i]!;
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = decodeURIComponent(requestSegments[i]!);
    } else if (seg !== requestSegments[i]) {
      return null;
    }
  }
  return params;
}

/** JSON.parse devolve objetos/arrays JS puros; FlexLang representa structs como
 * `Map` (ver `interpreter.ts` StructExpr) — conversão recursiva mantém `req.json()`
 * consistente com o resto da linguagem (acesso a propriedade via `.get`). */
function jsonToFlexValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonToFlexValue);
  if (value !== null && typeof value === "object") {
    const map = new Map<string, unknown>();
    for (const [k, v] of Object.entries(value)) map.set(k, jsonToFlexValue(v));
    return map;
  }
  return value;
}

/** `res.json`/`res.error` fazem o caminho inverso: `Map` -> objeto plain antes do `JSON.stringify`. */
function flexValueToJson(_key: string, value: unknown): unknown {
  return value instanceof Map ? Object.fromEntries(value) : value;
}

class FlexRequest {
  readonly [NATIVE_TAG] = "Request";

  constructor(
    private readonly params: Record<string, string>,
    private readonly queryParams: URLSearchParams,
    private readonly rawBody: string,
  ) {}

  param(name: string): string {
    return this.params[name] ?? "";
  }

  param_int(name: string) {
    const raw = this.params[name];
    if (raw === undefined) return resultErr(`missing path parameter '${name}'`);
    if (!INT_PATTERN.test(raw)) return resultErr(`path parameter '${name}' is not an Int`);
    return resultOk(parseInt(raw, 10));
  }

  query(name: string) {
    const v = this.queryParams.get(name);
    return v === null ? optionNone() : optionSome(v);
  }

  query_int(name: string) {
    const v = this.queryParams.get(name);
    if (v === null || !INT_PATTERN.test(v)) return optionNone();
    return optionSome(parseInt(v, 10));
  }

  json() {
    if (this.rawBody.trim() === "") return resultErr("empty request body");
    try {
      return resultOk(jsonToFlexValue(JSON.parse(this.rawBody)));
    } catch {
      return resultErr("invalid JSON body");
    }
  }
}

class FlexResponse {
  readonly [NATIVE_TAG] = "Response";
  private statusCode = 200;
  private written = false;

  constructor(private readonly raw: http.ServerResponse) {}

  status(code: number): FlexResponse {
    this.statusCode = code;
    return this;
  }

  json(data: unknown): null {
    this.write(this.statusCode, data);
    return null;
  }

  error(status: number, message: string): null {
    this.write(status, new Map([["error", message]]));
    return null;
  }

  /** Só para o `dispatch` do FlexServer: uma exceção não tratada no handler não
   * pode deixar a conexão pendurada sem resposta nenhuma. */
  errorIfUnwritten(status: number, message: string): void {
    this.write(status, new Map([["error", message]]));
  }

  private write(status: number, data: unknown): void {
    // Idempotente: em Go, escrever o header/corpo duas vezes é um bug em
    // potencial (Go só loga "superfluous response.WriteHeader call", não trava),
    // mas o interpretador tem estado suficiente para simplesmente ignorar.
    if (this.written) return;
    this.written = true;
    this.raw.writeHead(status, { "Content-Type": "application/json" });
    this.raw.end(JSON.stringify(data, flexValueToJson));
  }
}

/** Servidor HTTP em modo interpretado. No modo compilado, o equivalente é o
 * boilerplate Go abaixo — mesmo algoritmo de roteamento (varredura linear na
 * ordem de registro), para não divergir do interpretador em rotas ambíguas. */
class FlexServer {
  readonly [NATIVE_TAG] = "Server";
  private routes: CompiledRoute[] = [];
  private shutdownHooks: unknown[] = [];
  private server: http.Server;
  private maxBodySize: number;

  constructor(
    private addr: string,
    private interpreter: Interpreter,
    config?: Map<string, unknown>,
  ) {
    this.maxBodySize = positiveOr(config?.get("max_body_size"), DEFAULT_MAX_BODY_SIZE);
    const readTimeoutMs = positiveOr(config?.get("read_timeout"), DEFAULT_READ_TIMEOUT_MS);

    this.server = http.createServer((req, res) => this.dispatch(req, res));
    this.server.requestTimeout = readTimeoutMs;
  }

  route(path: string, handler: unknown): null {
    this.routes.push({ segments: pathSegments(path), handler });
    return null;
  }

  on_shutdown(handler: unknown): null {
    this.shutdownHooks.push(handler);
    return null;
  }

  private dispatch(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const requestSegments = pathSegments(url.pathname);

    for (const route of this.routes) {
      const params = matchRoute(route, requestSegments);
      if (!params) continue;

      this.readBody(req, res, (body) => {
        if (body === null) return; // já respondeu 413
        const request = new FlexRequest(params, url.searchParams, body);
        const response = new FlexResponse(res);
        void this.interpreter.callFunction(route.handler, [request, response]).catch((e) => {
          const entry = {
            level: "error",
            msg: "panic recovered",
            panic: e.message || String(e),
            ts: new Date().toISOString(),
          };
          console.log(JSON.stringify(entry));
          response.errorIfUnwritten(500, "internal server error");
        });
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }

  /** Lê o corpo respeitando `max_body_size`; responde 413 e aborta se estourar,
   * sem acumular mais dados do que o limite na memória do processo. */
  private readBody(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cb: (body: string | null) => void,
  ): void {
    let total = 0;
    const chunks: Buffer[] = [];
    let rejected = false;

    req.on("data", (chunk: Buffer) => {
      if (rejected) return;
      total += chunk.length;
      if (total > this.maxBodySize) {
        rejected = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "request body too large" }));
        req.destroy();
        cb(null);
      } else {
        chunks.push(chunk);
      }
    });

    req.on("end", () => {
      if (rejected) return;
      cb(Buffer.concat(chunks).toString("utf-8"));
    });
  }

  start(): Promise<never> {
    const port = parseInt(this.addr.replace(":", ""), 10);
    this.server.listen(port, () => console.log(`[FlexLang] Server listening on ${this.addr}`));

    const shutdown = async () => {
      console.log(`[FlexLang] Shutting down server...`);
      for (const hook of this.shutdownHooks) {
        await this.interpreter.callFunction(hook, []).catch(e => console.error(e));
      }
      this.server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Promessa que nunca resolve: mantém o interpretador vivo enquanto serve
    return new Promise(() => {});
  }
}

const GO_BOILERPLATE = [
  "// --- FlexLang HTTP Boilerplate (RFC-004) ---",
  "type ServerConfig struct {",
  "  read_timeout  int",
  "  max_body_size int",
  "}",
  "",
  "type Request struct {",
  "  params     map[string]string",
  "  queryParams url.Values",
  "  body       []byte",
  "}",
  "",
  "func (r Request) param(name string) string { return r.params[name] }",
  "",
  "func (r Request) param_int(name string) Result {",
  "  raw, present := r.params[name]",
  "  if !present {",
  '    return Result_Err_new("missing path parameter \'" + name + "\'")',
  "  }",
  "  n, err := strconv.Atoi(raw)",
  "  if err != nil {",
  '    return Result_Err_new("path parameter \'" + name + "\' is not an Int")',
  "  }",
  "  return Result_Ok_new(n)",
  "}",
  "",
  "func (r Request) query(name string) Option {",
  "  if !r.queryParams.Has(name) { return Option_None }",
  "  return Option_Some_new(r.queryParams.Get(name))",
  "}",
  "",
  "func (r Request) query_int(name string) Option {",
  "  if !r.queryParams.Has(name) { return Option_None }",
  "  n, err := strconv.Atoi(r.queryParams.Get(name))",
  "  if err != nil { return Option_None }",
  "  return Option_Some_new(n)",
  "}",
  "",
  "// req.json() (sem argumentos): o tipo concreto vem do site de chamada, via o",
  "// tipo que o TypeChecker resolveu (RFC-004) — o transpiler emite DecodeJSON[T]",
  "// em vez de um método, porque Go nao tem metodos genericos.",
  "func DecodeJSON[T any](req Request) Result {",
  '  if strings.TrimSpace(string(req.body)) == "" {',
  '    return Result_Err_new("empty request body")',
  "  }",
  "  var target T",
  "  if err := json.Unmarshal(req.body, &target); err != nil {",
  '    return Result_Err_new("invalid JSON body")',
  "  }",
  "  return Result_Ok_new(target)",
  "}",
  "",
  "type Response struct {",
  "  raw        http.ResponseWriter",
  "  statusCode int",
  "  written    bool",
  "}",
  "",
  "func (r *Response) status(code int) *Response { r.statusCode = code; return r }",
  "",
  "func (r *Response) json(data any) { r.write(r.statusCode, data) }",
  "",
  "func (r *Response) error(status int, message string) {",
  '  r.write(status, map[string]string{"error": message})',
  "}",
  "",
  "func (r *Response) write(status int, data any) {",
  "  if r.written { return }",
  "  r.written = true",
  '  r.raw.Header().Set("Content-Type", "application/json")',
  "  r.raw.WriteHeader(status)",
  "  json.NewEncoder(r.raw).Encode(data)",
  "}",
  "",
  "type flexRoute struct {",
  "  segments []string",
  "  handler  func(Request, *Response)",
  "}",
  "",
  "func flexSegments(path string) []string {",
  '  parts := strings.Split(path, "/")',
  "  segments := make([]string, 0, len(parts))",
  "  for _, p := range parts {",
  '    if p != "" { segments = append(segments, p) }',
  "  }",
  "  return segments",
  "}",
  "",
  "func flexMatchRoute(route flexRoute, reqSegments []string) (map[string]string, bool) {",
  "  if len(route.segments) != len(reqSegments) { return nil, false }",
  "  params := map[string]string{}",
  "  for i, seg := range route.segments {",
  '    if strings.HasPrefix(seg, ":") {',
  "      params[seg[1:]] = reqSegments[i]",
  "    } else if seg != reqSegments[i] {",
  "      return nil, false",
  "    }",
  "  }",
  "  return params, true",
  "}",
  "",
  "type Server struct {",
  "  Addr   string",
  "  routes []flexRoute",
  "  config ServerConfig",
  "  shutdownHooks []func()",
  "}",
  "",
  "func NewServer(addr string, cfg ...*ServerConfig) *Server {",
  "  conf := ServerConfig{read_timeout: 5000, max_body_size: 1000000}",
  "  if len(cfg) > 0 && cfg[0] != nil {",
  "    if cfg[0].read_timeout > 0 { conf.read_timeout = cfg[0].read_timeout }",
  "    if cfg[0].max_body_size > 0 { conf.max_body_size = cfg[0].max_body_size }",
  "  }",
  "  return &Server{Addr: addr, config: conf}",
  "}",
  "",
  "func (s *Server) on_shutdown(handler func()) {",
  "  s.shutdownHooks = append(s.shutdownHooks, handler)",
  "}",
  "",
  "func (s *Server) route(path string, handler func(Request, *Response)) {",
  "  s.routes = append(s.routes, flexRoute{segments: flexSegments(path), handler: handler})",
  "}",
  "",
  "func (s *Server) dispatch(w http.ResponseWriter, r *http.Request) {",
  "  defer func() {",
  "    if rec := recover(); rec != nil {",
  '      entry := map[string]any{',
  '        "level": "error",',
  '        "msg":   "panic recovered",',
  '        "panic": fmt.Sprintf("%v", rec),',
  '        "ts":    time.Now().Format(time.RFC3339),',
  '      }',
  '      out, _ := json.Marshal(entry)',
  '      fmt.Println(string(out))',
  '      w.Header().Set("Content-Type", "application/json")',
  '      w.WriteHeader(500)',
  '      json.NewEncoder(w).Encode(map[string]string{"error": "internal server error"})',
  "    }",
  "  }()",
  "",
  '  if r.Method == "GET" && r.URL.Path == "/healthz" {',
  '    w.Header().Set("Content-Type", "application/json")',
  "    w.WriteHeader(200)",
  '    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})',
  "    return",
  "  }",
  "",
  "  reqSegments := flexSegments(r.URL.Path)",
  "  for _, route := range s.routes {",
  "    params, ok := flexMatchRoute(route, reqSegments)",
  "    if !ok { continue }",
  "    body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, int64(s.config.max_body_size)))",
  "    if err != nil {",
  '      w.Header().Set("Content-Type", "application/json")',
  "      w.WriteHeader(413)",
  '      json.NewEncoder(w).Encode(map[string]string{"error": "request body too large"})',
  "      return",
  "    }",
  "    req := Request{params: params, queryParams: r.URL.Query(), body: body}",
  "    res := &Response{raw: w, statusCode: 200}",
  "    route.handler(req, res)",
  "    return",
  "  }",
  '  w.Header().Set("Content-Type", "application/json")',
  "  w.WriteHeader(404)",
  '  json.NewEncoder(w).Encode(map[string]string{"error": "not found"})',
  "}",
  "",
  "func (s *Server) start() {",
  "  mux := http.NewServeMux()",
  '  mux.HandleFunc("/", s.dispatch)',
  "  httpServer := &http.Server{",
  "    Addr:        s.Addr,",
  "    Handler:     mux,",
  "    ReadTimeout: time.Duration(s.config.read_timeout) * time.Millisecond,",
  "  }",
  "",
  "  go func() {",
  "    if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {",
  '      fmt.Printf("HTTP server error: %v\\n", err)',
  "    }",
  "  }()",
  "",
  "  quit := make(chan os.Signal, 1)",
  "  signal.Notify(quit, os.Interrupt, syscall.SIGTERM)",
  "  <-quit",
  "",
  "  ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)",
  "  defer cancel()",
  "",
  "  for _, hook := range s.shutdownHooks {",
  "    hook()",
  "  }",
  "",
  "  if err := httpServer.Shutdown(ctx); err != nil {",
  '    fmt.Printf("HTTP server shutdown error: %v\\n", err)',
  "  }",
  "}",
  "// ---------------------------------",
].join("\n");

export const httpModule: NativeModule = {
  path: "net/http",

  types: [
    {
      name: "Server",
      statics: [
        {
          name: "new",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Struct", name: "Server", genericArgs: [] },
        },
      ],
      methods: [
        { name: "route", arity: 2, returns: { kind: "Void" } },
        { name: "on_shutdown", arity: 1, returns: { kind: "Void" } },
        { name: "start", arity: 0, returns: { kind: "Void" } },
      ],
    },
    {
      name: "Request",
      methods: [
        { name: "param", arity: 1, returns: { kind: "String" } },
        {
          name: "param_int",
          arity: 1,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Int" }, { kind: "String" }] },
        },
        {
          name: "query",
          arity: 1,
          returns: { kind: "Enum", name: "Option", genericArgs: [{ kind: "String" }] },
        },
        {
          name: "query_int",
          arity: 1,
          returns: { kind: "Enum", name: "Option", genericArgs: [{ kind: "Int" }] },
        },
        // "json" fica de fora de propósito: seu retorno depende do tipo esperado
        // no site de chamada (RFC-004) — tratado como caso especial no checker.
      ],
    },
    {
      name: "Response",
      // Precisa de semântica de referência: `res.status(x)` e `res.json(x)` em
      // statements separados têm que mutar o mesmo valor (ver `goPointer` em types.ts).
      goPointer: true,
      methods: [
        { name: "status", arity: 1, returns: { kind: "Struct", name: "Response", genericArgs: [] } },
        { name: "json", arity: 1, returns: { kind: "Void" } },
        { name: "error", arity: 2, returns: { kind: "Void" } },
      ],
    },
    {
      name: "ServerConfig",
      properties: [
        { name: "read_timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "max_body_size", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (interpreter) => ({
    Server: {
      [NATIVE_TAG]: "Server",
      new: (addr: string, config?: Map<string, unknown>) => new FlexServer(addr, interpreter, config),
    },
    // ServerConfig precisa existir no ambiente do interpretador como uma
    // "StructDeclaration" para `ServerConfig { ... }` (StructExpr) funcionar —
    // o checker já a conhece via `nativeStructDeclaration`, mas o interpretador
    // resolve nomes de struct em tempo de execução separadamente (ver `evaluateExpr`
    // caso "StructExpr" em interpreter.ts).
    ServerConfig: {
      kind: "StructDeclaration",
      name: "ServerConfig",
      properties: [
        { name: "read_timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "max_body_size", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
  }),

  goCodegen: {
    imports: ["net/http", "net/url", "encoding/json", "io", "strconv", "strings", "time", "context", "os", "os/signal", "syscall", "fmt"],
    boilerplate: GO_BOILERPLATE,
  },
};
