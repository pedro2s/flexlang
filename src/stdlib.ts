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
