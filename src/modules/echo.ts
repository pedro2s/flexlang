import { NATIVE_TAG, type NativeModule } from "./types";

/**
 * Módulo nativo fictício, usado só pela suíte de testes (RFC-003).
 *
 * Não é registrado no `registry` por padrão: quem o registra é o runner dos
 * testes. É justamente essa a prova de que checker, interpretador e transpiler
 * não conhecem nenhum módulo por nome — um módulo que o core desconhece por
 * completo funciona nos dois modos de execução.
 */

class FlexEcho {
  readonly [NATIVE_TAG] = "Echo";

  constructor(private prefix: string) {}

  say(message: string): string {
    return this.prefix + message;
  }
}

const GO_BOILERPLATE = [
  "// --- FlexLang test/echo ---",
  "type Echo struct { Prefix string }",
  "func NewEcho(prefix string) *Echo { return &Echo{Prefix: prefix} }",
  "func (e *Echo) say(message string) string { return e.Prefix + message }",
  "// --------------------------",
].join("\n");

export const echoModule: NativeModule = {
  path: "test/echo",

  types: [
    {
      name: "Echo",
      statics: [{ name: "new", arity: 1, returns: { kind: "Struct", name: "Echo", genericArgs: [] } }],
      methods: [{ name: "say", arity: 1, returns: { kind: "String" } }],
    },
  ],

  runtimeBinding: () => ({
    Echo: {
      [NATIVE_TAG]: "Echo",
      new: (prefix: string) => new FlexEcho(prefix),
    },
  }),

  goCodegen: {
    imports: [], // nenhum import do Go: exercita o caso de boilerplate puro
    boilerplate: GO_BOILERPLATE,
  },
};
