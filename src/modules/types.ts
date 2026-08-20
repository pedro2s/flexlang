import type { EnumDeclaration, StructDeclaration, TypeNode } from "../ast";
import type { FlexType } from "../checker";
import type { Interpreter } from "../interpreter";

/**
 * Módulos nativos (RFC-003).
 *
 * Um módulo nativo é escrito pelo próprio time da FlexLang e compilado junto com
 * o compilador — não há carregamento dinâmico de terceiros. O que esta interface
 * resolve é não espalhar um `if moduleName === "..."` por checker, interpretador
 * e transpiler a cada módulo novo: cada módulo descreve, em um lugar só, a sua
 * superfície de tipos, o seu binding em modo interpretado e o Go que injeta.
 */

/**
 * Assinatura de um método nativo, para o checker validar a chamada.
 *
 * `arity` é a aridade exata (caso comum). `minArity`/`maxArity` cobrem aridade
 * variável — hoje só `Server.new(addr, config?)` (RFC-004), cujo `ServerConfig`
 * é opcional.
 */
export interface NativeSignature {
  name: string;
  arity?: number;
  minArity?: number;
  maxArity?: number;
  returns: FlexType;
}

export interface NativeType {
  name: string;
  /** Propriedades visíveis ao checker. Vazio = tipo opaco (o caso comum). */
  properties?: { name: string; typeAnnotation: TypeNode }[];
  /** Construtores estáticos: `Server.new(":8080")`. */
  statics?: NativeSignature[];
  /** Métodos de instância: `server.route(...)`. */
  methods?: NativeSignature[];
  /**
   * Este tipo precisa de semântica de referência em Go (`*Tipo`), não de valor.
   * Caso de uso: `Response` (RFC-004) — `res.status(201).json(x)` e `res.json(x)`
   * em statements separados precisam mutar o MESMO valor, como já acontece no
   * interpretador (objetos JS são sempre referência). Sem isso, um receiver por
   * valor em Go perderia mutações entre statements não encadeados.
   */
  goPointer?: boolean;
}

export interface NativeModule {
  /** Caminho usado no import, sem aspas: "net/http", "db/postgres". */
  path: string;

  /** O que o TypeChecker pré-registra ao ver o import. */
  types: NativeType[];

  /** Enums exportados diretamente pelo módulo nativo. */
  enums?: EnumDeclaration[];

  /** Funções livres exportadas diretamente pelo módulo nativo. */
  functions?: NativeSignature[];

  /**
   * Embutidos (`Result`/`Option`) que o boilerplate Go deste módulo referencia
   * diretamente (ex: `req.param_int` devolve `Result`). O transpiler não sabe o
   * que cada módulo faz por dentro do seu boilerplate — precisa que o módulo
   * declare essa dependência para emitir a definição no cabeçalho, mesmo que o
   * programa do usuário não use `Result`/`Option` em nenhum outro lugar.
   */
  usesBuiltins?: string[];

  /** Valores injetados no ambiente do interpretador quando o módulo é importado. */
  runtimeBinding: (interpreter: Interpreter) => Record<string, unknown>;

  /** O que o transpiler injeta no arquivo Go quando o módulo é importado. */
  goCodegen?: {
    imports: string[];
    boilerplate: string;
    thirdParty?: string[];
  };
}

/**
 * Marca instâncias nativas (o `FlexServer` do net/http, o `FlexChannel` do core).
 * Quem tem a marca expõe seus métodos como funções JS, e o interpretador
 * despacha todos por um caminho só — sem `instanceof` por classe nativa.
 */
export const NATIVE_TAG = "__flexNative";

export function isNativeObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && NATIVE_TAG in value;
}

/** Devolve o método nativo `name` de `value`, se existir. */
export function nativeMethod(value: unknown, name: string): ((...args: any[]) => any) | undefined {
  if (!isNativeObject(value)) return undefined;
  const member = value[name];
  return typeof member === "function" ? (member as (...args: any[]) => any).bind(value) : undefined;
}

/** A AST guarda o nome do módulo com as aspas do literal: `"net/http"`. */
export function modulePath(moduleName: string): string {
  return moduleName.replace(/^"|"$/g, "");
}

/** Declaração de struct equivalente a um tipo nativo, para a tabela do checker. */
export function nativeStructDeclaration(type: NativeType): StructDeclaration {
  return { kind: "StructDeclaration", name: type.name, properties: type.properties ?? [] };
}
