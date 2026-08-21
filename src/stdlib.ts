import type { EnumDeclaration, EnumVariantDecl } from "./ast";

/**
 * Tipos embutidos da linguagem (RFC-002).
 *
 * `Result<T, E>` e `Option<T>` são registrados incondicionalmente em todo programa
 * FlexLang — pelo checker, pelo interpretador e pelo transpiler — a partir desta
 * definição única. Os nomes de variante são fixos: a variante de sucesso é sempre
 * a primeira declarada (`Ok`/`Some`), o que é o que permite ao operador `?`
 * funcionar por checagem estrutural de tipo, sem heurística de nome.
 */

const T = { kind: "NamedTypeNode", name: "T" } as const;
const E = { kind: "NamedTypeNode", name: "E" } as const;

/** Nomes reservados pela stdlib: o usuário não pode declarar tipos com eles. */
export const BUILTIN_TYPE_NAMES = ["Result", "Option"];

/**
 * Devolve cópias novas das declarações embutidas: cada checker/transpiler tem a
 * sua, para que ninguém consiga mutar a definição compartilhada.
 */
export function builtinEnums(): EnumDeclaration[] {
  return [
    {
      kind: "EnumDeclaration",
      name: "Result",
      typeParams: ["T", "E"],
      variants: [
        { name: "Ok", payload: [{ ...T }] },
        { name: "Err", payload: [{ ...E }] },
      ],
    },
    {
      kind: "EnumDeclaration",
      name: "Option",
      typeParams: ["T"],
      variants: [{ name: "Some", payload: [{ ...T }] }, { name: "None" }],
    },
  ];
}

export function isBuiltinType(name: string): boolean {
  return BUILTIN_TYPE_NAMES.includes(name);
}

/**
 * A variante de sucesso de um tipo embutido — sempre a primeira declarada
 * (`Result.Ok`, `Option.Some`). É o que o `?` extrai; qualquer outra variante
 * é propagada como está.
 */
export function successVariant(decl: EnumDeclaration): EnumVariantDecl | undefined {
  return decl.variants[0];
}

/** True se `variantName` é a variante de sucesso do embutido `enumName`. */
export function isSuccessVariant(enumName: string, variantName: string): boolean {
  const decl = builtinEnums().find((e) => e.name === enumName);
  if (!decl) return false;
  return successVariant(decl)?.name === variantName;
}

/**
 * Forma runtime de uma variante de enum, como o interpretador já produz em
 * `MemberExpr`/`CallExpr` de construtor. Módulos nativos que precisam devolver
 * `Result`/`Option` (ex: `net/http`, RFC-004) constroem o valor direto por aqui,
 * em vez de duplicar o shape `{ kind: "EnumVariant", ... }` em cada módulo.
 */
export interface EnumVariantValue {
  kind: "EnumVariant";
  enumName: string;
  variantName: string;
  payload: unknown[];
  unwrap?: () => unknown;
}

export function resultOk(value: unknown): EnumVariantValue {
  return { kind: "EnumVariant", enumName: "Result", variantName: "Ok", payload: [value], unwrap: function() { return (this as any).payload[0]; } };
}

export function resultErr(message: unknown): EnumVariantValue {
  return { kind: "EnumVariant", enumName: "Result", variantName: "Err", payload: [message], unwrap: function() { throw new Error((this as any).payload[0]); } };
}

export function optionSome(value: unknown): EnumVariantValue {
  return { kind: "EnumVariant", enumName: "Option", variantName: "Some", payload: [value], unwrap: function() { return (this as any).payload[0]; } };
}

export function optionNone(): EnumVariantValue {
  return { kind: "EnumVariant", enumName: "Option", variantName: "None", payload: [], unwrap: function() { throw new Error("Unwrap on None"); } };
}
