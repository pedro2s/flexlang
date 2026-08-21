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
  method: string;
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

interface FlexCorsConfig {
  allow_origins: string[];
  allow_methods: string[];
  allow_headers: string[];
  max_age: number;
}

function parseMultipartBuffer(
  body: string,
  contentTypeHeader: string,
): { fields: Map<string, string>; files: Map<string, Map<string, unknown>> } {
  const fields = new Map<string, string>();
  const files = new Map<string, Map<string, unknown>>();

  const boundaryMatch = contentTypeHeader.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    return { fields, files };
  }

  let boundary = boundaryMatch[1]!.trim();
  if ((boundary.startsWith('"') && boundary.endsWith('"')) || (boundary.startsWith("'") && boundary.endsWith("'"))) {
    boundary = boundary.slice(1, -1);
  }

  const boundaryDelimiter = `--${boundary}`;
  const parts = body.split(boundaryDelimiter);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "--") continue;

    const headerEndIdx = part.indexOf("\r\n\r\n");
    const lfEndIdx = part.indexOf("\n\n");
    let headerStr = "";
    let partBody = "";

    if (headerEndIdx !== -1) {
      headerStr = part.slice(0, headerEndIdx);
      partBody = part.slice(headerEndIdx + 4);
    } else if (lfEndIdx !== -1) {
      headerStr = part.slice(0, lfEndIdx);
      partBody = part.slice(lfEndIdx + 2);
    } else {
      continue;
    }

    if (partBody.endsWith("\r\n")) {
      partBody = partBody.slice(0, -2);
    } else if (partBody.endsWith("\n")) {
      partBody = partBody.slice(0, -1);
    }

    let name = "";
    let filename: string | null = null;
    let contentType = "text/plain";

    for (const line of headerStr.split(/\r?\n/)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const hName = line.slice(0, colonIdx).trim().toLowerCase();
      const hVal = line.slice(colonIdx + 1).trim();

      if (hName === "content-disposition") {
        const nameMatch = hVal.match(/name="([^"]+)"/i);
        if (nameMatch) name = nameMatch[1]!;
        const fnMatch = hVal.match(/filename="([^"]+)"/i);
        if (fnMatch) filename = fnMatch[1]!;
      } else if (hName === "content-type") {
        contentType = hVal;
      }
    }

    if (!name) continue;

    if (filename !== null) {
      const fileMap = new Map<string, unknown>();
      fileMap.set("__structName", "UploadedFile");
      fileMap.set("filename", filename);
      fileMap.set("content_type", contentType);
      fileMap.set("size", Buffer.byteLength(partBody, "utf-8"));
      fileMap.set("content", partBody);
      files.set(name, fileMap);
    } else {
      fields.set(name, partBody);
    }
  }

  return { fields, files };
}

function parseUrlEncodedBody(rawBody: string): Map<string, string> {
  const fields = new Map<string, string>();
  const params = new URLSearchParams(rawBody);
  for (const [k, v] of params.entries()) {
    fields.set(k, v);
  }
  return fields;
}

class FlexRequest {
  readonly [NATIVE_TAG] = "Request";
  private formFields: Map<string, string> | null = null;
  private formFiles: Map<string, Map<string, unknown>> | null = null;

  constructor(
    private params: Record<string, string>,
    private readonly queryParams: URLSearchParams,
    private readonly rawBody: string,
    private readonly rawHeaders: Record<string, string | string[] | undefined> = {},
  ) {}

  private ensureFormParsed(): void {
    if (this.formFields !== null) return;
    this.formFields = new Map<string, string>();
    this.formFiles = new Map<string, Map<string, unknown>>();

    const ct = String(this.rawHeaders["content-type"] || "");
    if (ct.includes("multipart/form-data")) {
      const parsed = parseMultipartBuffer(this.rawBody, ct);
      this.formFields = parsed.fields;
      this.formFiles = parsed.files;
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      this.formFields = parseUrlEncodedBody(this.rawBody);
    }
  }

  setParams(params: Record<string, string>): void {
    this.params = params;
  }

  param(name: string): string {
    return this.params[name] ?? "";
  }

  param_int(name: string) {
    const raw = this.params[name];
    if (raw === undefined) return resultErr(`missing path parameter '${name}'`);
    if (!INT_PATTERN.test(raw)) return resultErr(`path parameter '${name}' is not an Int`);
    return resultOk(parseInt(raw, 10));
  }

  header(name: string) {
    const raw = this.rawHeaders[name.toLowerCase()];
    if (raw === undefined) return optionNone();
    if (Array.isArray(raw)) return optionSome(raw.join(", "));
    return optionSome(String(raw));
  }

  headers(): Map<string, string> {
    const map = new Map<string, string>();
    for (const [k, v] of Object.entries(this.rawHeaders)) {
      if (v !== undefined) {
        map.set(k.toLowerCase(), Array.isArray(v) ? v.join(", ") : String(v));
      }
    }
    return map;
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

  form_value(name: string) {
    this.ensureFormParsed();
    const val = this.formFields!.get(name);
    return val !== undefined ? optionSome(val) : optionNone();
  }

  form_file(name: string) {
    this.ensureFormParsed();
    const file = this.formFiles!.get(name);
    return file !== undefined ? optionSome(file) : optionNone();
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
  private responseHeaders: Record<string, string> = {};

  constructor(
    private readonly raw: http.ServerResponse,
    private readonly isHead = false,
  ) {}

  status(code: number): FlexResponse {
    this.statusCode = code;
    return this;
  }

  header(name: string, value: string): FlexResponse {
    if (this.written) return this;
    this.responseHeaders[name] = value;
    return this;
  }

  getHeaders(): Record<string, string> {
    return { ...this.responseHeaders };
  }

  isWritten(): boolean {
    return this.written;
  }

  json(data: unknown): null {
    this.write(this.statusCode, data);
    return null;
  }

  send_string(data: string): null {
    if (this.written) return null;
    this.written = true;
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      ...this.responseHeaders,
    };
    this.raw.writeHead(this.statusCode, defaultHeaders);
    if (this.isHead) {
      this.raw.end();
    } else {
      this.raw.end(String(data));
    }
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
    this.raw.writeHead(status, {
      "Content-Type": "application/json",
      ...this.responseHeaders,
    });
    if (this.isHead) {
      this.raw.end();
    } else {
      this.raw.end(JSON.stringify(data, flexValueToJson));
    }
  }
}

/** Servidor HTTP em modo interpretado. No modo compilado, o equivalente é o
 * boilerplate Go abaixo — mesmo algoritmo de roteamento (varredura linear na
 * ordem de registro), para não divergir do interpretador em rotas ambíguas. */
class FlexServer {
  readonly [NATIVE_TAG] = "Server";
  private routes: CompiledRoute[] = [];
  private middlewares: unknown[] = [];
  private corsConfig: FlexCorsConfig | null = null;
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

  use(middleware: unknown): null {
    this.middlewares.push(middleware);
    return null;
  }

  cors(config: Map<string, unknown>): null {
    const getArray = (k: string): string[] => {
      const val = config.get(k);
      return Array.isArray(val) ? val.map(String) : [];
    };
    this.corsConfig = {
      allow_origins: getArray("allow_origins"),
      allow_methods: getArray("allow_methods"),
      allow_headers: getArray("allow_headers"),
      max_age: positiveOr(config.get("max_age"), 0),
    };
    return null;
  }

  get(path: string, handler: unknown): null {
    this.routes.push({ method: "GET", segments: pathSegments(path), handler });
    return null;
  }

  post(path: string, handler: unknown): null {
    this.routes.push({ method: "POST", segments: pathSegments(path), handler });
    return null;
  }

  put(path: string, handler: unknown): null {
    this.routes.push({ method: "PUT", segments: pathSegments(path), handler });
    return null;
  }

  patch(path: string, handler: unknown): null {
    this.routes.push({ method: "PATCH", segments: pathSegments(path), handler });
    return null;
  }

  delete(path: string, handler: unknown): null {
    this.routes.push({ method: "DELETE", segments: pathSegments(path), handler });
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
    const reqMethod = (req.method || "GET").toUpperCase();

    this.readBody(req, res, async (body) => {
      if (body === null) return; // já respondeu 413
      const request = new FlexRequest({}, url.searchParams, body, req.headers);
      const response = new FlexResponse(res, reqMethod === "HEAD");

      // CORS
      let isCorsAllowed = false;
      let matchingOrigin = "";
      if (this.corsConfig) {
        const originHeader = req.headers["origin"];
        const origin = typeof originHeader === "string" ? originHeader : "";
        for (const o of this.corsConfig.allow_origins) {
          if (o === "*") {
            isCorsAllowed = true;
            matchingOrigin = "*";
            break;
          } else if (origin !== "" && o === origin) {
            isCorsAllowed = true;
            matchingOrigin = origin;
            break;
          }
        }

        if (isCorsAllowed) {
          response.header("Access-Control-Allow-Origin", matchingOrigin);
          if (matchingOrigin !== "*") {
            response.header("Vary", "Origin");
          }
        }
      }

      // Preflight OPTIONS para CORS
      if (reqMethod === "OPTIONS" && this.corsConfig && isCorsAllowed) {
        response.header("Access-Control-Allow-Methods", this.corsConfig.allow_methods.join(", "));
        response.header("Access-Control-Allow-Headers", this.corsConfig.allow_headers.join(", "));
        if (this.corsConfig.max_age > 0) {
          response.header("Access-Control-Max-Age", String(this.corsConfig.max_age));
        }

        const allowedMethodsSet = new Set<string>();
        for (const route of this.routes) {
          if (matchRoute(route, requestSegments)) {
            allowedMethodsSet.add(route.method);
          }
        }
        if (allowedMethodsSet.has("GET")) allowedMethodsSet.add("HEAD");
        allowedMethodsSet.add("OPTIONS");

        const standardOrder = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
        const allowedMethods = standardOrder.filter((m) => allowedMethodsSet.has(m));
        if (allowedMethods.length > 0) {
          response.header("Allow", allowedMethods.join(", "));
        }

        const outHeaders: Record<string, string> = { ...response.getHeaders() };
        res.writeHead(204, outHeaders);
        res.end();
        return;
      }

      // 1. Executa cadeia de middlewares na ordem de registro
      for (const mw of this.middlewares) {
        try {
          await this.interpreter.callFunction(mw, [request, response]);
        } catch (e: any) {
          const entry = {
            level: "error",
            msg: "panic recovered in middleware",
            panic: e.message || String(e),
            ts: new Date().toISOString(),
          };
          console.log(JSON.stringify(entry));
          response.errorIfUnwritten(500, "internal server error");
        }
        if (response.isWritten()) {
          return;
        }
      }

      // 2. Roteamento: casamento exato método + path (ou HEAD em rotas GET)
      for (const route of this.routes) {
        if (route.method !== reqMethod && !(reqMethod === "HEAD" && route.method === "GET")) {
          continue;
        }
        const params = matchRoute(route, requestSegments);
        if (!params) continue;

        request.setParams(params);

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
        return;
      }

      // 3. Se nenhuma casou, busca se o path existe com outros verbos
      const allowedMethodsSet = new Set<string>();
      for (const route of this.routes) {
        if (matchRoute(route, requestSegments)) {
          allowedMethodsSet.add(route.method);
        }
      }

      if (allowedMethodsSet.size > 0) {
        if (allowedMethodsSet.has("GET")) {
          allowedMethodsSet.add("HEAD");
        }
        allowedMethodsSet.add("OPTIONS");

        const standardOrder = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
        const allowedMethods = standardOrder.filter((m) => allowedMethodsSet.has(m));
        const allowHeader = allowedMethods.join(", ");

        if (reqMethod === "OPTIONS") {
          response.header("Allow", allowHeader);
          const outHeaders: Record<string, string> = { ...response.getHeaders() };
          res.writeHead(204, outHeaders);
          res.end();
          return;
        }

        response.header("Allow", allowHeader);
        response.status(405).error(405, "method not allowed");
        return;
      }

      response.status(404).error(404, "not found");
    });
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

class FlexMultipartForm {
  readonly [NATIVE_TAG] = "MultipartForm";
  public formData = new FormData();

  add_field(name: string, value: string): null {
    this.formData.append(name, value);
    return null;
  }

  add_file(name: string, filename: string, content: string): null {
    // Node 18+ nativo File/Blob support for fetch
    const blob = new Blob([content], { type: "application/octet-stream" });
    this.formData.append(name, blob, filename);
    return null;
  }
}

class FlexClientResponse {
  readonly [NATIVE_TAG] = "ClientResponse";
  constructor(
    private readonly _status: number,
    private readonly _body: string,
    private readonly _headers: Map<string, string>
  ) {}

  status(): number { return this._status; }
  body(): string { return this._body; }
}

class FlexHttpClient {
  readonly [NATIVE_TAG] = "Client";
  private timeoutMs: number;

  constructor(config?: Map<string, unknown>) {
    const t = config?.get("timeout_ms");
    this.timeoutMs = typeof t === "number" && t > 0 ? t : 10000;
  }

  private async doFetch(url: string, init: RequestInit): Promise<any> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(id);
      const body = await res.text();
      const headers = new Map<string, string>();
      res.headers.forEach((v, k) => headers.set(k, v));
      return resultOk(new FlexClientResponse(res.status, body, headers));
    } catch (e: any) {
      clearTimeout(id);
      if (e.name === "AbortError") return resultErr("timeout");
      return resultErr(e.message || String(e));
    }
  }

  async get(url: string): Promise<any> {
    return this.doFetch(url, { method: "GET" });
  }

  async post(url: string, body: string): Promise<any> {
    return this.doFetch(url, { method: "POST", body });
  }

  async post_json(url: string, data: Map<string, unknown>): Promise<any> {
    return this.doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data)),
    });
  }

  async put(url: string, body: string): Promise<any> {
    return this.doFetch(url, { method: "PUT", body });
  }

  async delete(url: string): Promise<any> {
    return this.doFetch(url, { method: "DELETE" });
  }

  async post_multipart(url: string, form: FlexMultipartForm): Promise<any> {
    return this.doFetch(url, {
      method: "POST",
      body: form.formData, // O fetch gerencia automaticamente o Content-Type com o boundary
    });
  }
}

const GO_BOILERPLATE = [
  "// --- FlexLang HTTP Boilerplate (RFC-004 / RFC-011 / RFC-015) ---",
  "type ServerConfig struct {",
  "  read_timeout  int",
  "  max_body_size int",
  "}",
  "",
  "type CorsConfig struct {",
  "  allow_origins []string",
  "  allow_methods []string",
  "  allow_headers []string",
  "  max_age       int",
  "}",
  "",
  "type UploadedFile struct {",
  "  filename     string",
  "  content_type string",
  "  size         int",
  "  content      string",
  "}",
  "",
  "type Request struct {",
  "  params      map[string]string",
  "  queryParams url.Values",
  "  rawHeaders  http.Header",
  "  body        []byte",
  "  rawRequest  *http.Request",
  "}",
  "",
  "func (r Request) param(name string) string { return r.params[name] }",
  "",
  "func (r Request) header(name string) Option {",
  "  v := r.rawHeaders.Get(name)",
  "  if v == \"\" {",
  "    for k, vals := range r.rawHeaders {",
  "      if strings.EqualFold(k, name) && len(vals) > 0 {",
  "        v = vals[0]",
  "        break",
  "      }",
  "    }",
  "    if v == \"\" {",
  "      return Option_None",
  "    }",
  "  }",
  "  return Option_Some_new(v)",
  "}",
  "",
  "func (r Request) headers() map[string]any {",
  "  res := make(map[string]any)",
  "  for k, vals := range r.rawHeaders {",
  "    if len(vals) > 0 {",
  "      res[strings.ToLower(k)] = strings.Join(vals, \", \")",
  "    }",
  "  }",
  "  return res",
  "}",
  "",
  "func (r Request) param_int(name string) Result {",
  "  raw, present := r.params[name]",
  "  if !present {",
  "    return Result_Err_new(\"missing path parameter '\" + name + \"'\")",
  "  }",
  "  n, err := strconv.Atoi(raw)",
  "  if err != nil {",
  "    return Result_Err_new(\"path parameter '\" + name + \"' is not an Int\")",
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
  "func (r Request) form_value(name string) Option {",
  "  if r.rawRequest != nil {",
  "    if val := r.rawRequest.FormValue(name); val != \"\" {",
  "      return Option_Some_new(val)",
  "    }",
  "    if r.rawRequest.MultipartForm != nil && r.rawRequest.MultipartForm.Value != nil {",
  "      if vals, ok := r.rawRequest.MultipartForm.Value[name]; ok && len(vals) > 0 {",
  "        return Option_Some_new(vals[0])",
  "      }",
  "    }",
  "  }",
  "  if strings.Contains(r.rawHeaders.Get(\"Content-Type\"), \"application/x-www-form-urlencoded\") {",
  "    vals, err := url.ParseQuery(string(r.body))",
  "    if err == nil {",
  "      if val := vals.Get(name); val != \"\" {",
  "        return Option_Some_new(val)",
  "      }",
  "    }",
  "  }",
  "  return Option_None",
  "}",
  "",
  "func (r Request) form_file(name string) Option {",
  "  if r.rawRequest != nil {",
  "    _ = r.rawRequest.ParseMultipartForm(32 << 20)",
  "    if r.rawRequest.MultipartForm != nil && r.rawRequest.MultipartForm.File != nil {",
  "      if files, ok := r.rawRequest.MultipartForm.File[name]; ok && len(files) > 0 {",
  "        fh := files[0]",
  "        f, err := fh.Open()",
  "        if err == nil {",
  "          defer f.Close()",
  "          data, _ := io.ReadAll(f)",
  "          ct := fh.Header.Get(\"Content-Type\")",
  "          if ct == \"\" {",
  "            ct = \"application/octet-stream\"",
  "          }",
  "          return Option_Some_new(UploadedFile{",
  "            filename:     fh.Filename,",
  "            content_type: ct,",
  "            size:         int(fh.Size),",
  "            content:      string(data),",
  "          })",
  "        }",
  "      }",
  "    }",
  "  }",
  "  return Option_None",
  "}",
  "",
  "// req.json() (sem argumentos): o tipo concreto vem do site de chamada, via o",
  "// tipo que o TypeChecker resolveu (RFC-004) — o transpiler emite DecodeJSON[T]",
  "// em vez de um método, porque Go nao tem metodos genericos.",
  "func DecodeJSON[T any](req Request) Result {",
  "  if strings.TrimSpace(string(req.body)) == \"\" {",
  "    return Result_Err_new(\"empty request body\")",
  "  }",
  "  var target T",
  "  if err := json.Unmarshal(req.body, &target); err != nil {",
  "    return Result_Err_new(\"invalid JSON body\")",
  "  }",
  "  return Result_Ok_new(target)",
  "}",
  "",
  "type Response struct {",
  "  raw        http.ResponseWriter",
  "  statusCode int",
  "  headers    map[string]string",
  "  written    bool",
  "  isHead     bool",
  "}",
  "",
  "func (r *Response) status(code int) *Response { r.statusCode = code; return r }",
  "",
  "func (r *Response) header(name string, value string) *Response {",
  "  if r.written { return r }",
  "  if r.headers == nil { r.headers = map[string]string{} }",
  "  r.headers[name] = value",
  "  return r",
  "}",
  "",
  "func (r *Response) json(data any) { r.write(r.statusCode, data) }",
  "",
  "func (r *Response) send_string(data string) {",
  "  if r.written { return }",
  "  r.written = true",
  "  if r.headers == nil || r.headers[\"Content-Type\"] == \"\" {",
  "    r.raw.Header().Set(\"Content-Type\", \"text/plain; charset=utf-8\")",
  "  }",
  "  for k, v := range r.headers {",
  "    r.raw.Header().Set(k, v)",
  "  }",
  "  r.raw.WriteHeader(r.statusCode)",
  "  if !r.isHead {",
  "    r.raw.Write([]byte(data))",
  "  }",
  "}",
  "",
  "func (r *Response) error(status int, message string) {",
  "  r.write(status, map[string]string{\"error\": message})",
  "}",
  "",
  "func (r *Response) write(status int, data any) {",
  "  if r.written { return }",
  "  r.written = true",
  '  r.raw.Header().Set("Content-Type", "application/json")',
  "  for k, v := range r.headers {",
  "    r.raw.Header().Set(k, v)",
  "  }",
  "  r.raw.WriteHeader(status)",
  "  if !r.isHead {",
  "    json.NewEncoder(r.raw).Encode(data)",
  "  }",
  "}",
  "",
  "type flexRoute struct {",
  "  method   string",
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
  "  Addr          string",
  "  routes        []flexRoute",
  "  middlewares   []func(Request, *Response)",
  "  corsConfig    *CorsConfig",
  "  config        ServerConfig",
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
  "func (s *Server) use(middleware func(Request, *Response)) {",
  "  s.middlewares = append(s.middlewares, middleware)",
  "}",
  "",
  "func (s *Server) cors(cfg *CorsConfig) {",
  "  s.corsConfig = cfg",
  "}",
  "",
  "func (s *Server) get(path string, handler func(Request, *Response)) {",
  '  s.routes = append(s.routes, flexRoute{method: "GET", segments: flexSegments(path), handler: handler})',
  "}",
  "",
  "func (s *Server) post(path string, handler func(Request, *Response)) {",
  '  s.routes = append(s.routes, flexRoute{method: "POST", segments: flexSegments(path), handler: handler})',
  "}",
  "",
  "func (s *Server) put(path string, handler func(Request, *Response)) {",
  '  s.routes = append(s.routes, flexRoute{method: "PUT", segments: flexSegments(path), handler: handler})',
  "}",
  "",
  "func (s *Server) patch(path string, handler func(Request, *Response)) {",
  '  s.routes = append(s.routes, flexRoute{method: "PATCH", segments: flexSegments(path), handler: handler})',
  "}",
  "",
  "func (s *Server) delete(path string, handler func(Request, *Response)) {",
  '  s.routes = append(s.routes, flexRoute{method: "DELETE", segments: flexSegments(path), handler: handler})',
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
  "  body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, int64(s.config.max_body_size)))",
  "  if err != nil {",
  '    w.Header().Set("Content-Type", "application/json")',
  "    w.WriteHeader(413)",
  '    json.NewEncoder(w).Encode(map[string]string{"error": "request body too large"})',
  "    return",
  "  }",
  "  r.Body = io.NopCloser(bytes.NewReader(body))",
  "  req := Request{params: map[string]string{}, queryParams: r.URL.Query(), rawHeaders: r.Header, body: body, rawRequest: r}",
  '  res := &Response{raw: w, statusCode: 200, headers: map[string]string{}, isHead: r.Method == "HEAD"}',
  "",
  "  // CORS",
  "  isCorsAllowed := false",
  "  matchingOrigin := \"\"",
  "  if s.corsConfig != nil {",
  '    origin := r.Header.Get("Origin")',
  "    for _, o := range s.corsConfig.allow_origins {",
  '      if o == "*" {',
  "        isCorsAllowed = true",
  '        matchingOrigin = "*"',
  "        break",
  '      } else if origin != "" && o == origin {',
  "        isCorsAllowed = true",
  "        matchingOrigin = origin",
  "        break",
  "      }",
  "    }",
  "    if isCorsAllowed {",
  '      res.header("Access-Control-Allow-Origin", matchingOrigin)',
  '      if matchingOrigin != "*" {',
  '        res.header("Vary", "Origin")',
  "      }",
  "    }",
  "  }",
  "",
  '  if r.Method == "OPTIONS" && s.corsConfig != nil && isCorsAllowed {',
  '    w.Header().Set("Access-Control-Allow-Origin", matchingOrigin)',
  '    if matchingOrigin != "*" {',
  '      w.Header().Set("Vary", "Origin")',
  "    }",
  '    w.Header().Set("Access-Control-Allow-Methods", strings.Join(s.corsConfig.allow_methods, ", "))',
  '    w.Header().Set("Access-Control-Allow-Headers", strings.Join(s.corsConfig.allow_headers, ", "))',
  "    if s.corsConfig.max_age > 0 {",
  '      w.Header().Set("Access-Control-Max-Age", strconv.Itoa(s.corsConfig.max_age))',
  "    }",
  "    allowedMap := map[string]bool{}",
  "    for _, route := range s.routes {",
  "      if _, ok := flexMatchRoute(route, reqSegments); ok {",
  "        allowedMap[route.method] = true",
  "      }",
  "    }",
  '    if allowedMap["GET"] { allowedMap["HEAD"] = true }',
  '    allowedMap["OPTIONS"] = true',
  '    standardOrder := []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}',
  "    allowedMethods := []string{}",
  "    for _, m := range standardOrder {",
  "      if allowedMap[m] {",
  "        allowedMethods = append(allowedMethods, m)",
  "      }",
  "    }",
  '    if len(allowedMethods) > 0 {',
  '      w.Header().Set("Allow", strings.Join(allowedMethods, ", "))',
  "    }",
  "    w.WriteHeader(204)",
  "    return",
  "  }",
  "",
  "  // 1. Executa middlewares",
  "  for _, mw := range s.middlewares {",
  "    mw(req, res)",
  "    if res.written {",
  "      return",
  "    }",
  "  }",
  "",
  "  // 2. Roteamento: casamento exato",
  "  for _, route := range s.routes {",
  "    if route.method != r.Method && !(r.Method == \"HEAD\" && route.method == \"GET\") {",
  "      continue",
  "    }",
  "    params, ok := flexMatchRoute(route, reqSegments)",
  "    if !ok { continue }",
  "    req.params = params",
  "    route.handler(req, res)",
  "    return",
  "  }",
  "",
  "  // 3. Verifica outros métodos no mesmo path",
  "  allowedMap := map[string]bool{}",
  "  for _, route := range s.routes {",
  "    if _, ok := flexMatchRoute(route, reqSegments); ok {",
  "      allowedMap[route.method] = true",
  "    }",
  "  }",
  "",
  "  if len(allowedMap) > 0 {",
  '    if allowedMap["GET"] {',
  '      allowedMap["HEAD"] = true',
  "    }",
  '    allowedMap["OPTIONS"] = true',
  "",
  '    standardOrder := []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}',
  "    allowedMethods := []string{}",
  "    for _, m := range standardOrder {",
  "      if allowedMap[m] {",
  "        allowedMethods = append(allowedMethods, m)",
  "      }",
  "    }",
  '    allowHeader := strings.Join(allowedMethods, ", ")',
  "",
  '    if r.Method == "OPTIONS" {',
  '      res.header("Allow", allowHeader)',
  "      for k, v := range res.headers {",
  "        w.Header().Set(k, v)",
  "      }",
  "      w.WriteHeader(204)",
  "      return",
  "    }",
  "",
  '    res.header("Allow", allowHeader)',
  '    res.status(405).error(405, "method not allowed")',
  "    return",
  "  }",
  "",
  '  res.status(404).error(404, "not found")',
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
  "",
  "type ClientConfig struct {",
  "  timeout_ms int",
  "}",
  "",
  "type ClientResponse struct {",
  "  _status  int",
  "  _body    string",
  "  _headers map[string]string",
  "}",
  "",
  "func ClientResponse_status(res any) int { return res.(*ClientResponse)._status }",
  "func ClientResponse_body(res any) string { return res.(*ClientResponse)._body }",
  "",
  "type MultipartForm struct {",
  "  buf    *bytes.Buffer",
  "  writer *multipart.Writer",
  "}",
  "",
  "func NewMultipartForm() *MultipartForm {",
  "  b := &bytes.Buffer{}",
  "  return &MultipartForm{buf: b, writer: multipart.NewWriter(b)}",
  "}",
  "",
  "func (m *MultipartForm) add_field(name string, value string) {",
  "  m.writer.WriteField(name, value)",
  "}",
  "",
  "func (m *MultipartForm) add_file(name string, filename string, content string) {",
  "  part, _ := m.writer.CreateFormFile(name, filename)",
  "  part.Write([]byte(content))",
  "}",
  "",
  "type Client struct {",
  "  raw *http.Client",
  "}",
  "",
  "func Client_default() *Client {",
  "  return NewClient(nil)",
  "}",
  "",
  "func NewClient(cfg *ClientConfig) *Client {",
  "  t := 10000",
  "  if cfg != nil && cfg.timeout_ms > 0 { t = cfg.timeout_ms }",
  "  return &Client{",
  "    raw: &http.Client{Timeout: time.Duration(t) * time.Millisecond},",
  "  }",
  "}",
  "",
  "func (c *Client) doFetch(req *http.Request) Result {",
  "  res, err := c.raw.Do(req)",
  "  if err != nil {",
  "    if os.IsTimeout(err) { return Result_Err_new(\"timeout\") }",
  "    return Result_Err_new(err.Error())",
  "  }",
  "  defer res.Body.Close()",
  "  b, _ := io.ReadAll(res.Body)",
  "  headers := map[string]string{}",
  "  for k, v := range res.Header {",
  "    if len(v) > 0 { headers[k] = v[0] }",
  "  }",
  "  return Result_Ok_new(&ClientResponse{_status: res.StatusCode, _body: string(b), _headers: headers})",
  "}",
  "",
  "func (c *Client) get(url string) Result {",
  "  req, _ := http.NewRequest(\"GET\", url, nil)",
  "  return c.doFetch(req)",
  "}",
  "",
  "func (c *Client) delete(url string) Result {",
  "  req, _ := http.NewRequest(\"DELETE\", url, nil)",
  "  return c.doFetch(req)",
  "}",
  "",
  "func (c *Client) post(url string, body string) Result {",
  "  req, _ := http.NewRequest(\"POST\", url, strings.NewReader(body))",
  "  return c.doFetch(req)",
  "}",
  "",
  "func (c *Client) put(url string, body string) Result {",
  "  req, _ := http.NewRequest(\"PUT\", url, strings.NewReader(body))",
  "  return c.doFetch(req)",
  "}",
  "",
  "func (c *Client) post_json(url string, data any) Result {",
  "  b, _ := json.Marshal(data)",
  "  req, _ := http.NewRequest(\"POST\", url, bytes.NewReader(b))",
  "  req.Header.Set(\"Content-Type\", \"application/json\")",
  "  return c.doFetch(req)",
  "}",
  "",
  "func (c *Client) post_multipart(url string, form *MultipartForm) Result {",
  "  form.writer.Close()",
  "  req, _ := http.NewRequest(\"POST\", url, form.buf)",
  "  req.Header.Set(\"Content-Type\", form.writer.FormDataContentType())",
  "  return c.doFetch(req)",
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
        { name: "use", arity: 1, returns: { kind: "Void" } },
        { name: "cors", arity: 1, returns: { kind: "Void" } },
        { name: "get", arity: 2, returns: { kind: "Void" } },
        { name: "post", arity: 2, returns: { kind: "Void" } },
        { name: "put", arity: 2, returns: { kind: "Void" } },
        { name: "patch", arity: 2, returns: { kind: "Void" } },
        { name: "delete", arity: 2, returns: { kind: "Void" } },
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
        {
          name: "form_value",
          arity: 1,
          returns: { kind: "Enum", name: "Option", genericArgs: [{ kind: "String" }] },
        },
        {
          name: "form_file",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Option",
            genericArgs: [{ kind: "Struct", name: "UploadedFile", genericArgs: [] }],
          },
        },
        {
          name: "header",
          arity: 1,
          returns: { kind: "Enum", name: "Option", genericArgs: [{ kind: "String" }] },
        },
        {
          name: "headers",
          arity: 0,
          returns: { kind: "HashMap", keyType: { kind: "String" }, valueType: { kind: "String" } },
        },
      ],
    },
    {
      name: "UploadedFile",
      properties: [
        { name: "filename", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "content_type", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "size", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "content", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
      ],
    },
    {
      name: "Response",
      goPointer: true,
      methods: [
        { name: "status", arity: 1, returns: { kind: "Struct", name: "Response", genericArgs: [] } },
        { name: "header", arity: 2, returns: { kind: "Struct", name: "Response", genericArgs: [] } },
        { name: "json", arity: 1, returns: { kind: "Void" } },
        { name: "send_string", arity: 1, returns: { kind: "Void" } },
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
    {
      name: "CorsConfig",
      properties: [
        { name: "allow_origins", typeAnnotation: { kind: "ArrayTypeNode", elementType: { kind: "NamedTypeNode", name: "String" } } },
        { name: "allow_methods", typeAnnotation: { kind: "ArrayTypeNode", elementType: { kind: "NamedTypeNode", name: "String" } } },
        { name: "allow_headers", typeAnnotation: { kind: "ArrayTypeNode", elementType: { kind: "NamedTypeNode", name: "String" } } },
        { name: "max_age", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "ClientConfig",
      properties: [
        { name: "timeout_ms", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "ClientResponse",
      goPointer: true,
      statics: [
        { name: "status", arity: 1, returns: { kind: "Int" } },
        { name: "body", arity: 1, returns: { kind: "String" } },
      ],
      methods: [],
    },
    {
      name: "MultipartForm",
      goPointer: true,
      statics: [
        { name: "new", arity: 0, returns: { kind: "Struct", name: "MultipartForm", genericArgs: [] } },
      ],
      methods: [
        { name: "add_field", arity: 2, returns: { kind: "Void" } },
        { name: "add_file", arity: 3, returns: { kind: "Void" } },
      ],
    },
    {
      name: "Client",
      goPointer: true,
      statics: [
        { name: "default", arity: 0, returns: { kind: "Struct", name: "Client", genericArgs: [] } },
        { name: "new", arity: 1, returns: { kind: "Struct", name: "Client", genericArgs: [] } },
      ],
      methods: [
        { name: "get", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "ClientResponse", genericArgs: [] }, { kind: "String" }] } },
        { name: "delete", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "ClientResponse", genericArgs: [] }, { kind: "String" }] } },
        { name: "post", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "ClientResponse", genericArgs: [] }, { kind: "String" }] } },
        { name: "post_json", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "ClientResponse", genericArgs: [] }, { kind: "String" }] } },
        { name: "put", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "ClientResponse", genericArgs: [] }, { kind: "String" }] } },
        { name: "post_multipart", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "ClientResponse", genericArgs: [] }, { kind: "String" }] } },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (interpreter) => ({
    Server: {
      [NATIVE_TAG]: "Server",
      new: (addr: string, config?: Map<string, unknown>) => new FlexServer(addr, interpreter, config),
    },
    ServerConfig: {
      kind: "StructDeclaration",
      name: "ServerConfig",
      properties: [
        { name: "read_timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "max_body_size", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    CorsConfig: {
      kind: "StructDeclaration",
      name: "CorsConfig",
      properties: [
        { name: "allow_origins", typeAnnotation: { kind: "ArrayTypeNode", elementType: { kind: "NamedTypeNode", name: "String" } } },
        { name: "allow_methods", typeAnnotation: { kind: "ArrayTypeNode", elementType: { kind: "NamedTypeNode", name: "String" } } },
        { name: "allow_headers", typeAnnotation: { kind: "ArrayTypeNode", elementType: { kind: "NamedTypeNode", name: "String" } } },
        { name: "max_age", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    UploadedFile: {
      kind: "StructDeclaration",
      name: "UploadedFile",
      properties: [
        { name: "filename", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "content_type", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "size", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "content", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
      ],
    },
    MultipartForm: {
      [NATIVE_TAG]: "MultipartForm",
      new: () => new FlexMultipartForm(),
    },
    Client: {
      [NATIVE_TAG]: "Client",
      default: () => new FlexHttpClient(),
      new: (config?: Map<string, unknown>) => new FlexHttpClient(config),
    },
    ClientConfig: {
      kind: "StructDeclaration",
      name: "ClientConfig",
      properties: [
        { name: "timeout_ms", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    ClientResponse: {
      [NATIVE_TAG]: "ClientResponse",
      status: (res: any) => res.status(),
      body: (res: any) => res.body(),
    },
  }),

  goCodegen: {
    imports: ["net/http", "net/url", "encoding/json", "io", "strconv", "strings", "time", "context", "os", "os/signal", "syscall", "fmt", "bytes", "mime/multipart"],
    boilerplate: GO_BOILERPLATE,
  },
};
