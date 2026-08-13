import * as http from "http";
import type { Interpreter } from "../interpreter";
import { NATIVE_TAG, type NativeModule } from "./types";

/** Servidor HTTP em modo interpretado. No modo compilado, o equivalente é o boilerplate Go abaixo. */
class FlexServer {
  readonly [NATIVE_TAG] = "Server";
  private routes = new Map<string, unknown>();
  private server: http.Server;

  constructor(
    private addr: string,
    private interpreter: Interpreter,
  ) {
    this.server = http.createServer((req, res) => {
      const handler = this.routes.get(req.url || "/");
      if (!handler) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const request = new Map<string, unknown>();
      const response = new Map<string, unknown>();
      response.set("json", (data: unknown) => {
        res.setHeader("Content-Type", "application/json");
        // Structs da FlexLang são Maps em memória; viram objetos no JSON
        res.end(JSON.stringify(data, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v)));
      });

      void this.interpreter.callFunction(handler, [request, response]).catch((e) => {
        console.error("Error in handler:", e);
      });
    });
  }

  route(path: string, handler: unknown): null {
    this.routes.set(path, handler);
    return null;
  }

  start(): Promise<never> {
    const port = parseInt(this.addr.replace(":", ""));
    this.server.listen(port, () => console.log(`[FlexLang] Server listening on ${this.addr}`));
    // Promessa que nunca resolve: mantém o interpretador vivo enquanto serve
    return new Promise(() => {});
  }
}

const GO_BOILERPLATE = [
  "// --- FlexLang HTTP Boilerplate ---",
  "type Request struct { Raw *http.Request }",
  "type Response struct { Raw http.ResponseWriter }",
  "func (r Response) json(data any) {",
  '    r.Raw.Header().Set("Content-Type", "application/json")',
  "    json.NewEncoder(r.Raw).Encode(data)",
  "}",
  "type Server struct { Addr string; Mux *http.ServeMux }",
  "func NewServer(addr string) *Server { return &Server{Addr: addr, Mux: http.NewServeMux()} }",
  "func (s *Server) route(path string, handler func(req Request, res Response)) {",
  "    s.Mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) { handler(Request{Raw: r}, Response{Raw: w}) })",
  "}",
  "func (s *Server) start() { http.ListenAndServe(s.Addr, s.Mux) }",
  "// ---------------------------------",
].join("\n");

export const httpModule: NativeModule = {
  path: "net/http",

  types: [
    {
      name: "Server",
      statics: [{ name: "new", arity: 1, returns: { kind: "Struct", name: "Server", genericArgs: [] } }],
      methods: [
        { name: "route", arity: 2, returns: { kind: "Void" } },
        { name: "start", arity: 0, returns: { kind: "Void" } },
      ],
    },
    { name: "Request" },
    { name: "Response" },
  ],

  runtimeBinding: (interpreter) => ({
    Server: {
      [NATIVE_TAG]: "Server",
      new: (addr: string) => new FlexServer(addr, interpreter),
    },
  }),

  goCodegen: {
    imports: ["net/http", "encoding/json"],
    boilerplate: GO_BOILERPLATE,
  },
};
