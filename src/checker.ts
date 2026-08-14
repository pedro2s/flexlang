import type {
  Expr,
  Stmt,
  TypeNode,
  StructDeclaration,
  FunctionDeclaration,
  EnumDeclaration,
  TraitDeclaration,
  ImplDeclaration,
  ImportDeclaration,
} from "./ast";
import { builtinEnums, isBuiltinType, successVariant } from "./stdlib";
import { registry } from "./modules/registry";
import {
  modulePath,
  nativeStructDeclaration,
  type NativeSignature,
  type NativeType,
} from "./modules/types";
import {
  type ModuleGraph,
  isLocalModule,
  resolveModuleFilePath,
} from "./loader";

// --- Representação Interna de Tipos do TypeChecker ---
export type FlexType =
  | { kind: "Int" }
  | { kind: "String" }
  | { kind: "Bool" }
  | { kind: "Array"; elementType: FlexType }
  | { kind: "Struct"; name: string; genericArgs: FlexType[] }
  | { kind: "Enum"; name: string; genericArgs: FlexType[] }
  | { kind: "Void" }
  | { kind: "Any" }; // Usado quando falha a inferência para evitar de dar 'cascade' de erros

// Anotação de tipos produzida durante a checagem: cada nó de expressão da AST
// mapeado para o tipo que o checker inferiu para ele.
// O GoTranspiler consome esse mapa para emitir tipos concretos (ex: `[]int{...}`
// em vez de `[]any{...}`) — ver RFC-001, seção "Onde o tipo resolvido do checker é necessário".
export type TypeMap = Map<Expr, FlexType>;

// --- Ambiente de Tipos (Environment para checagem estática) ---
class TypeEnvironment {
  private variables = new Map<string, { type: FlexType; isMut: boolean; isMoved: boolean }>();

  constructor(private enclosing?: TypeEnvironment) {}

  define(name: string, type: FlexType, isMut: boolean): void {
    this.variables.set(name, { type, isMut, isMoved: false });
  }

  get(name: string): { type: FlexType; isMut: boolean; isMoved: boolean } | undefined {
    if (this.variables.has(name)) {
      return this.variables.get(name)!;
    }
    if (this.enclosing) {
      return this.enclosing.get(name);
    }
    return undefined;
  }

  markMoved(name: string): void {
    if (this.variables.has(name)) {
      this.variables.get(name)!.isMoved = true;
    } else if (this.enclosing) {
      this.enclosing.markMoved(name);
    }
  }
}

// --- O Type Checker Central ---
export class TypeChecker {
  private env: TypeEnvironment = new TypeEnvironment();
  private structs: Map<string, StructDeclaration> = new Map();
  private functions: Map<string, FunctionDeclaration> = new Map();
  private enums: Map<string, EnumDeclaration> = new Map();
  private traits: Map<string, TraitDeclaration> = new Map();
  /** Superfície dos módulos nativos importados (RFC-003), por nome de tipo. */
  private nativeTypes: Map<string, NativeType> = new Map();
  private inScopeContext: number = 0;
  private typeMap: TypeMap = new Map();

  /**
   * Checa o programa e devolve a anotação de tipos de cada expressão.
   * Aceita tanto uma lista de statements (arquivo único) quanto um ModuleGraph (multi-arquivo).
   * O retorno é aditivo: quem só quer validar pode continuar ignorando-o.
   */
  public check(program: Stmt[] | ModuleGraph): TypeMap {
    // Result<T, E> e Option<T> existem em todo programa, sem import e sem declaração.
    for (const builtin of builtinEnums()) {
      this.enums.set(builtin.name, builtin);
    }

    const graph: ModuleGraph = Array.isArray(program)
      ? {
          entryPath: "main.flex",
          files: new Map([
            [
              "main.flex",
              {
                filePath: "main.flex",
                ast: program,
                imports: program.filter((s): s is ImportDeclaration => s.kind === "ImportDeclaration"),
                declarations: program.filter(
                  (s) =>
                    s.kind === "StructDeclaration" ||
                    s.kind === "FunctionDeclaration" ||
                    s.kind === "EnumDeclaration" ||
                    s.kind === "TraitDeclaration" ||
                    s.kind === "ImplDeclaration",
                ),
                localDependencies: [],
              },
            ],
          ]),
          order: ["main.flex"],
        }
      : program;

    // Tabelas de declarações próprias de cada arquivo no grafo
    const fileOwnSymbols = new Map<
      string,
      {
        structs: Map<string, StructDeclaration>;
        functions: Map<string, FunctionDeclaration>;
        enums: Map<string, EnumDeclaration>;
        traits: Map<string, TraitDeclaration>;
        nativeTypes: Map<string, NativeType>;
      }
    >();

    // Primeira Passagem (Pass 1 - Parte A): Registrar declarações top-level de cada arquivo
    for (const [filePath, sourceFile] of graph.files.entries()) {
      const fileStructs = new Map<string, StructDeclaration>();
      const fileFunctions = new Map<string, FunctionDeclaration>();
      const fileEnums = new Map<string, EnumDeclaration>();
      const fileTraits = new Map<string, TraitDeclaration>();
      const fileNativeTypes = new Map<string, NativeType>();

      for (const stmt of sourceFile.ast) {
        if (
          (stmt.kind === "StructDeclaration" ||
            stmt.kind === "EnumDeclaration" ||
            stmt.kind === "TraitDeclaration") &&
          isBuiltinType(stmt.name)
        ) {
          throw new Error(
            `TypeError: '${stmt.name}' is a built-in type and cannot be redeclared`,
          );
        }

        if (stmt.kind === "StructDeclaration") {
          fileStructs.set(stmt.name, stmt);
        } else if (stmt.kind === "FunctionDeclaration") {
          fileFunctions.set(stmt.name, stmt);
        } else if (stmt.kind === "EnumDeclaration") {
          fileEnums.set(stmt.name, stmt);
        } else if (stmt.kind === "TraitDeclaration") {
          fileTraits.set(stmt.name, stmt);
        } else if (stmt.kind === "ImportDeclaration") {
          if (!isLocalModule(stmt.moduleName)) {
            const path = modulePath(stmt.moduleName);
            const mod = registry.get(path);
            if (!mod) {
              throw new Error(`ImportError: Module '${path}' not found`);
            }
            for (const nativeType of mod.types) {
              fileStructs.set(nativeType.name, nativeStructDeclaration(nativeType));
              fileNativeTypes.set(nativeType.name, nativeType);
            }
          }
        }
      }

      fileOwnSymbols.set(filePath, {
        structs: fileStructs,
        functions: fileFunctions,
        enums: fileEnums,
        traits: fileTraits,
        nativeTypes: fileNativeTypes,
      });
    }

    // Primeira Passagem (Pass 1 - Parte B): Montar o escopo visível de cada arquivo com base nos imports
    const fileScopes = new Map<
      string,
      {
        structs: Map<string, StructDeclaration>;
        functions: Map<string, FunctionDeclaration>;
        enums: Map<string, EnumDeclaration>;
        traits: Map<string, TraitDeclaration>;
        nativeTypes: Map<string, NativeType>;
      }
    >();

    for (const [filePath, sourceFile] of graph.files.entries()) {
      const own = fileOwnSymbols.get(filePath)!;
      const visibleStructs = new Map<string, StructDeclaration>(own.structs);
      const visibleFunctions = new Map<string, FunctionDeclaration>(own.functions);
      const visibleEnums = new Map<string, EnumDeclaration>(this.enums); // Enums embutidos (Result, Option)
      for (const [k, v] of own.enums) visibleEnums.set(k, v);
      const visibleTraits = new Map<string, TraitDeclaration>(own.traits);
      const visibleNativeTypes = new Map<string, NativeType>(own.nativeTypes);

      for (const stmt of sourceFile.ast) {
        if (stmt.kind === "ImportDeclaration" && isLocalModule(stmt.moduleName)) {
          const targetPath = resolveModuleFilePath(filePath, stmt.moduleName, graph.files);
          const targetSymbols = fileOwnSymbols.get(targetPath);
          if (!targetSymbols) {
            throw new Error(`ImportError: Module '${modulePath(stmt.moduleName)}' not found`);
          }

          for (const sym of stmt.imports) {
            let found = false;
            if (targetSymbols.structs.has(sym)) {
              visibleStructs.set(sym, targetSymbols.structs.get(sym)!);
              if (targetSymbols.nativeTypes.has(sym)) {
                visibleNativeTypes.set(sym, targetSymbols.nativeTypes.get(sym)!);
              }
              found = true;
            }
            if (targetSymbols.functions.has(sym)) {
              visibleFunctions.set(sym, targetSymbols.functions.get(sym)!);
              found = true;
            }
            if (targetSymbols.enums.has(sym)) {
              visibleEnums.set(sym, targetSymbols.enums.get(sym)!);
              found = true;
            }
            if (targetSymbols.traits.has(sym)) {
              visibleTraits.set(sym, targetSymbols.traits.get(sym)!);
              found = true;
            }

            if (!found) {
              throw new Error(
                `ImportError: Symbol '${sym}' not found in module '${modulePath(stmt.moduleName)}'`,
              );
            }
          }
        }
      }

      fileScopes.set(filePath, {
        structs: visibleStructs,
        functions: visibleFunctions,
        enums: visibleEnums,
        traits: visibleTraits,
        nativeTypes: visibleNativeTypes,
      });
    }

    // Segunda Passagem (Pass 2): Checagem profunda na ordem topológica
    for (const filePath of graph.order) {
      const sourceFile = graph.files.get(filePath)!;
      const scope = fileScopes.get(filePath)!;

      this.structs = scope.structs;
      this.functions = scope.functions;
      this.enums = scope.enums;
      this.traits = scope.traits;
      this.nativeTypes = scope.nativeTypes;

      const fileEnv = new TypeEnvironment(this.env);
      for (const stmt of sourceFile.ast) {
        this.checkStmt(stmt, fileEnv);
      }
    }

    return this.typeMap;
  }

  /** Anotação de tipos da última checagem (vazia antes de `check()` rodar). */
  public getTypeMap(): TypeMap {
    return this.typeMap;
  }

  // =========== CHECAGEM DE STATEMENTS ===========

  private checkStmt(stmt: Stmt, env: TypeEnvironment): void {
    switch (stmt.kind) {
      case "VarDeclaration": {
        // Anotação resolvida ANTES de checar o valor: alguns nós (ex: `req.json()`,
        // RFC-004) precisam saber o tipo esperado no site de chamada para resolver
        // seu próprio tipo de retorno — não dá para inferir de baixo pra cima
        // porque `json()` não tem argumento nenhum que carregue essa informação.
        const expected = stmt.typeAnnotation ? this.resolveTypeNode(stmt.typeAnnotation) : undefined;
        const valueType = this.checkExpr(stmt.value, env, expected);

        if (expected && !this.isTypeAssignable(expected, valueType)) {
          throw new Error(
            `TypeError: Cannot assign value of type '${this.typeToString(valueType)}' to variable '${stmt.name}' of type '${this.typeToString(expected)}'`,
          );
        }
        env.define(stmt.name, expected ?? valueType, stmt.isMut);
        break;
      }

      case "ScopeStmt":
        if (stmt.deadline) {
            const deadlineType = this.checkExpr(stmt.deadline, env);
            // Idealmente exigiriamos um tipo Duration, mas por hora Int serve
            if (deadlineType.kind !== "Int" && deadlineType.kind !== "Any") {
                 throw new Error(`TypeError: scope deadline must be an Int, got ${this.typeToString(deadlineType)}`);
            }
        }
        this.inScopeContext++;
        this.checkStmt(stmt.body, env);
        this.inScopeContext--;
        break;

      case "SpawnStmt":
        if (this.inScopeContext === 0) {
            throw new Error("SyntaxError: 'spawn' can only be called inside a 'scope' block");
        }
        this.checkStmt(stmt.body, env);
        break;

      case "ExpressionStatement":
        this.checkExpr(stmt.expression, env);
        break;

      case "PrintStmt":
        this.checkExpr(stmt.value, env);
        break;

      case "BlockStmt":
        const blockEnv = new TypeEnvironment(env);
        for (const s of stmt.body) {
          this.checkStmt(s, blockEnv);
        }
        break;

      case "IfStmt":
        const condType = this.checkExpr(stmt.condition, env);
        if (condType.kind !== "Bool" && condType.kind !== "Any") {
          throw new Error(`TypeError: If condition must be Bool, got ${this.typeToString(condType)}`);
        }
        this.checkStmt(stmt.consequent, env);
        if (stmt.alternate) {
          this.checkStmt(stmt.alternate, env);
        }
        break;

      case "WhileStmt":
        const wCondType = this.checkExpr(stmt.condition, env);
        if (wCondType.kind !== "Bool" && wCondType.kind !== "Any") {
          throw new Error(`TypeError: While condition must be Bool, got ${this.typeToString(wCondType)}`);
        }
        this.checkStmt(stmt.body, env);
        break;

      case "ForStmt":
        const startType = this.checkExpr(stmt.start, env);
        const endType = this.checkExpr(stmt.end, env);
        if (startType.kind !== "Int" || endType.kind !== "Int") {
          throw new Error("TypeError: For loop bounds must be Int");
        }
        const forEnv = new TypeEnvironment(env);
        forEnv.define(stmt.iteratorName, { kind: "Int" }, false);
        this.checkStmt(stmt.body, forEnv);
        break;

      case "FunctionDeclaration":
        // Registra a função local/closure para permitir Type Checking das suas chamadas mais abaixo
        this.functions.set(stmt.name, stmt);
        
        const funcEnv = new TypeEnvironment(env);
        const retType = stmt.returnType ? this.resolveTypeNode(stmt.returnType) : { kind: "Void" } as FlexType;
        funcEnv.define("__RETURN_TYPE__", retType, false);
        
        for (const param of stmt.parameters) {
          funcEnv.define(param.name, this.resolveTypeNode(param.typeAnnotation), !!param.isMut);
        }
        this.checkStmt(stmt.body, funcEnv);
        break;

      case "ReturnStmt":
        if (stmt.value) {
          const returnedType = this.checkExpr(stmt.value, env);
          const expectedReturn = env.get("__RETURN_TYPE__");
          // Valida a instanciação dos embutidos: `Result.Ok(x)` aceita qualquer x
          // (T é livre na construção), então é aqui que o T declarado é cobrado.
          if (
            expectedReturn &&
            expectedReturn.type.kind === "Enum" &&
            isBuiltinType(expectedReturn.type.name) &&
            returnedType.kind === "Enum" &&
            !this.isTypeAssignable(expectedReturn.type, returnedType)
          ) {
            throw new Error(
              `TypeError: Cannot return ${this.typeToString(returnedType)} from a function that returns ${this.typeToString(expectedReturn.type)}`,
            );
          }
        }
        break;

      case "StructDeclaration":
      case "EnumDeclaration":
      case "TraitDeclaration":
        // Hookados no Pass 1
        break;
        
      case "ImplDeclaration":
        if (stmt.traitName) {
             const trait = this.traits.get(stmt.traitName);
             if (!trait) throw new Error(`ReferenceError: Trait '${stmt.traitName}' not found`);
             
             // Validação da interface
             for (const tMethod of trait.methods) {
                  const iMethod = stmt.methods.find(m => m.name === tMethod.name);
                  if (!iMethod) throw new Error(`TypeError: Struct '${stmt.structName}' does not implement method '${tMethod.name}' from trait '${stmt.traitName}'`);
                  const iParams = iMethod.parameters.filter(p => p.name !== "self");
                  if (tMethod.parameters.length !== iParams.length) {
                       throw new Error(`TypeError: Method '${tMethod.name}' in impl does not match trait signature for parameters count`);
                  }
             }
        }
        
        // Avaliar corpo dos metodos do Impl
        for (const m of stmt.methods) {
             const mEnv = new TypeEnvironment(env);
             mEnv.define("self", { kind: "Struct", name: stmt.structName, genericArgs: [] }, true);
             for (const param of m.parameters) {
                 if (param.name !== "self") {
                     mEnv.define(param.name, this.resolveTypeNode(param.typeAnnotation), !!param.isMut);
                 }
             }
             this.checkStmt(m.body, mEnv);
        }
        break;

      case "MatchStmt":
        const matchValueType = this.checkExpr(stmt.value, env);
        if (matchValueType.kind !== "Enum" && matchValueType.kind !== "Any") {
            throw new Error(`TypeError: match expression must be an Enum, got ${this.typeToString(matchValueType)}`);
        }
        
        const enumDeclMatch = matchValueType.kind === "Enum" ? this.enums.get(matchValueType.name) : undefined;
        const matchedVariants = new Set<string>();

        for (const arm of stmt.arms) {
            if (enumDeclMatch && arm.enumName !== enumDeclMatch.name) {
                 throw new Error(`TypeError: match arm is for enum '${arm.enumName}', but matching on '${enumDeclMatch.name}'`);
            }
            const eDecl = this.enums.get(arm.enumName);
            if (!eDecl) throw new Error(`ReferenceError: Enum '${arm.enumName}' not found`);
            const variant = eDecl.variants.find(v => v.name === arm.variantName);
            if (!variant) throw new Error(`ReferenceError: Variant '${arm.variantName}' not found`);
            
            const payloadTypes = variant.payload || [];
            if (payloadTypes.length !== arm.binders.length) {
                 throw new Error(`TypeError: Match arm binds ${arm.binders.length} variables, but variant '${arm.variantName}' has ${payloadTypes.length} fields`);
            }
            
            // Os binders recebem o payload já com T/E trocados pelos tipos concretos
            // da instanciação sendo casada (ex: Result<Int, String> -> Ok(v): Int).
            const armSubst = this.genericSubst(
                eDecl,
                matchValueType.kind === "Enum" ? matchValueType.genericArgs : [],
            );
            const armEnv = new TypeEnvironment(env);
            for (let i = 0; i < arm.binders.length; i++) {
                 armEnv.define(arm.binders[i], this.resolveTypeNode(payloadTypes[i], armSubst), false);
            }
            
            this.checkStmt(arm.body, armEnv);
            matchedVariants.add(arm.variantName);
        }

        // Checagem de exhaustiveness
        if (enumDeclMatch) {
            for (const v of enumDeclMatch.variants) {
                if (!matchedVariants.has(v.name)) {
                     throw new Error(`TypeError: match is not exhaustive, missing variant '${v.name}'`);
                }
            }
        }
        break;
    }
  }

  // =========== CHECAGEM DE EXPRESSÕES ===========

  /**
   * @param expected tipo esperado pelo contexto que envolve `expr` (hoje só
   *                  populado por `VarDeclaration` com anotação). A grande
   *                  maioria dos casos de `inferExpr` ignora esse parâmetro —
   *                  só quem precisa dele (o `req.json()` do RFC-004, via `TryExpr`
   *                  e `CallExpr`) o consome.
   */
  private checkExpr(expr: Expr, env: TypeEnvironment, expected?: FlexType): FlexType {
    const type = this.inferExpr(expr, env, expected);
    this.typeMap.set(expr, type);
    return type;
  }

  private inferExpr(expr: Expr, env: TypeEnvironment, expected?: FlexType): FlexType {
    switch (expr.kind) {
      case "NumericLiteral":
        return { kind: "Int" };
      case "BooleanLiteral":
        return { kind: "Bool" };
      case "StringLiteral":
        return { kind: "String" };
      case "StringInterpolationExpr":
        for (const part of expr.parts) {
          if (typeof part !== "string") {
            this.checkExpr(part, env);
          }
        }
        return { kind: "String" };
        
      case "Identifier":
        const varInfo = env.get(expr.symbol);
        if (varInfo) {
            if (varInfo.isMoved) {
                throw new Error(`TypeError: Use-after-send of moved variable '${expr.symbol}'`);
            }
            return varInfo.type;
        }
        
        if (this.functions.has(expr.symbol)) {
            return { kind: "Any" };
        }
        
        throw new Error(`ReferenceError: Identifier '${expr.symbol}' not found`);

      case "BinaryExpr":
        const leftType = this.checkExpr(expr.left, env);
        const rightType = this.checkExpr(expr.right, env);
        
        // Verificaçôes simplificadas de relacional e igualdade
        if (["==", "!=", "<", "<=", ">", ">="].includes(expr.operator)) {
            return { kind: "Bool" };
        }
        
        // Matemático
        if ((leftType.kind !== "Int" && leftType.kind !== "Any") || (rightType.kind !== "Int" && rightType.kind !== "Any")) {
          throw new Error(`TypeError: Operator ${expr.operator} requires Ints, got ${this.typeToString(leftType)} and ${this.typeToString(rightType)}`);
        }
        return { kind: "Int" };

      case "LogicalExpr":
        this.checkExpr(expr.left, env);
        this.checkExpr(expr.right, env);
        return { kind: "Bool" };

      case "UnaryExpr":
        const uType = this.checkExpr(expr.argument, env);
        if (expr.operator === "!" && uType.kind !== "Bool") {
           throw new Error(`TypeError: ! operator requires Bool`);
        }
        if (expr.operator === "-" && uType.kind !== "Int") {
           throw new Error(`TypeError: - operator requires Int`);
        }
        return uType;

      case "ArrayLiteral":
        if (expr.elements.length === 0) return { kind: "Array", elementType: { kind: "Any" } };
        const firstType = this.checkExpr(expr.elements[0], env);
        // Valida que todos os outros são do mesmo tipo
        for (let i = 1; i < expr.elements.length; i++) {
            const nextType = this.checkExpr(expr.elements[i], env);
            if (!this.isTypeAssignable(firstType, nextType)) {
                 throw new Error("TypeError: Array elements must be of the same type");
            }
        }
        return { kind: "Array", elementType: firstType };

      case "IndexExpr":
        const arrType = this.checkExpr(expr.object, env);
        if (arrType.kind !== "Array" && arrType.kind !== "Any") {
            throw new Error(`TypeError: Cannot index into type ${this.typeToString(arrType)}`);
        }
        const idxType = this.checkExpr(expr.index, env);
        if (idxType.kind !== "Int") throw new Error("TypeError: Array index must be Int");
        return arrType.kind === "Array" ? arrType.elementType : { kind: "Any" };

      case "StructExpr":
        for (const prop of expr.properties) {
          this.checkExpr(prop.value, env);
        }
        return { kind: "Struct", name: expr.structName, genericArgs: [] };

      case "MemberExpr":
        if (expr.object.kind === "Identifier" && this.enums.has(expr.object.symbol)) {
             const enumName = expr.object.symbol;
             const variantName = expr.property;
             const enumDecl = this.enums.get(enumName)!;
             const variant = enumDecl.variants.find(v => v.name === variantName);
             if (!variant) throw new Error(`ReferenceError: Variant '${variantName}' not found in enum '${enumName}'`);
             
             if (variant.payload && variant.payload.length > 0) {
                 throw new Error(`TypeError: Variant '${variantName}' expects ${variant.payload.length} arguments, got 0`);
             }
             // Variante sem payload (ex: Option.None) não diz nada sobre T.
             return {
                 kind: "Enum",
                 name: enumName,
                 genericArgs: (enumDecl.typeParams ?? []).map(() => ({ kind: "Any" }) as FlexType),
             };
        }
        // Não valida o campo em si (limitação conhecida — "pula checagem
        // complexa"), mas registra o tipo do OBJETO no TypeMap: o transpiler
        // precisa saber se é um struct do usuário para decidir a capitalização
        // do campo em Go (json.Marshal/Unmarshal só enxerga campo exportado —
        // RFC-004, onde structs passam a de fato trafegar como JSON).
        this.checkExpr(expr.object, env);
        return { kind: "Any" };

      case "CallExpr":
        if (expr.caller.kind === "MemberExpr" && expr.caller.object.kind === "Identifier" && this.enums.has(expr.caller.object.symbol)) {
             const enumName = expr.caller.object.symbol;
             const variantName = expr.caller.property;
             
             const enumDecl = this.enums.get(enumName)!;
             const variant = enumDecl.variants.find(v => v.name === variantName);
             if (!variant) throw new Error(`ReferenceError: Variant '${variantName}' not found in enum '${enumName}'`);
             
             const payloadTypes = variant.payload || [];
             if (payloadTypes.length !== expr.args.length) {
                 throw new Error(`TypeError: Variant '${variantName}' expects ${payloadTypes.length} arguments, got ${expr.args.length}`);
             }

             // Na construção, os parâmetros de tipo ainda são livres: qualquer
             // argumento serve para T/E, e é dele que a instanciação é inferida.
             const freeSubst = this.genericSubst(enumDecl, []);
             const argTypes: FlexType[] = [];
             for (let i = 0; i < expr.args.length; i++) {
                 const argType = this.checkExpr(expr.args[i], env);
                 argTypes.push(argType);
                 const expectedType = this.resolveTypeNode(payloadTypes[i], freeSubst);
                 if (!this.isTypeAssignable(expectedType, argType)) {
                      throw new Error(`TypeError: Argument ${i+1} of variant '${variantName}' must be ${this.typeToString(expectedType)}, got ${this.typeToString(argType)}`);
                 }
             }
             return { kind: "Enum", name: enumName, genericArgs: this.inferGenericArgs(enumDecl, payloadTypes, argTypes) };
        }
        
        if (expr.caller.kind === "Identifier") {
           const func = this.functions.get(expr.caller.symbol);
           if (!func) {
              const struct = this.structs.get(expr.caller.symbol);
              if (struct) {
                 return { kind: "Struct", name: struct.name, genericArgs: [] };
              }
              // Caso não ache, pode ser uma variável tipo closure/função (que ainda não modelamos forte)
              // mas para funções nomeadas, falhamos.
              const varType = env.get(expr.caller.symbol);
              if (varType) return { kind: "Any" }; // closure call
              
              throw new Error(`ReferenceError: Function or Struct '${expr.caller.symbol}' not found`);
           }
           
           if (func.parameters.length !== expr.args.length) {
              throw new Error(`TypeError: Function '${func.name}' expects ${func.parameters.length} arguments, got ${expr.args.length}`);
           }
           
           for (let i = 0; i < expr.args.length; i++) {
              const argType = this.checkExpr(expr.args[i], env);
              const paramType = this.resolveTypeNode(func.parameters[i].typeAnnotation);
              if (!this.isTypeAssignable(paramType, argType)) {
                  throw new Error(`TypeError: Argument ${i + 1} of function '${func.name}' must be ${this.typeToString(paramType)}, got ${this.typeToString(argType)}`);
              }
           }
           
           if (func.returnType) {
               return this.resolveTypeNode(func.returnType);
           }
           return { kind: "Void" };
        }
        
        if (expr.caller.kind === "MemberExpr") {
            // Channel é primitivo da linguagem (não vem de import): `send` move o
            // valor, e `recv` devolve o tipo do canal — semânticas que uma
            // assinatura de módulo nativo não expressa.
            if (expr.caller.object.kind === "Identifier" && expr.caller.object.symbol === "Channel" && expr.caller.property === "new") {
                const genericArgs = expected && expected.kind === "Struct" && expected.name === "Channel" ? expected.genericArgs : [{ kind: "Any" } as FlexType];
                return { kind: "Struct", name: "Channel", genericArgs };
            }

            // `req.json()` (RFC-004): o `T` de `Result<T, String>` não vem de
            // nenhum argumento (a chamada não tem argumento nenhum) — só do
            // contexto (`let body: T = req.json()?;`). Por isso é tratado à parte
            // da tabela genérica de `NativeSignature`, que não modela retorno
            // dependente do site de chamada.
            if (expr.caller.property === "json" && expr.args.length === 0) {
                const objType = this.checkExpr(expr.caller.object, env);
                if (objType.kind === "Struct" && objType.name === "Request") {
                    let payloadType: FlexType = { kind: "Any" };
                    if (expected) {
                        if (expected.kind === "Enum" && expected.name === "Result" && expected.genericArgs[0]) {
                            payloadType = expected.genericArgs[0];
                        } else if (expected.kind !== "Void") {
                            payloadType = expected;
                        }
                    }
                    return {
                        kind: "Enum",
                        name: "Result",
                        genericArgs: [payloadType, { kind: "String" }],
                    };
                }
            }

            // Construtor estático de módulo nativo: `Server.new(...)`
            if (expr.caller.object.kind === "Identifier") {
                const staticSig = this.nativeTypes
                    .get(expr.caller.object.symbol)
                    ?.statics?.find((s) => s.name === expr.caller.property);
                if (staticSig) {
                    return this.checkNativeCall(`${expr.caller.object.symbol}.${staticSig.name}`, staticSig, expr.args, env);
                }
            }

            const callerType = this.checkExpr(expr.caller.object, env);
            if (callerType.kind === "Struct" && callerType.name === "Channel") {
                if (expr.caller.property === "send") {
                    if (expr.args.length !== 1) throw new Error("TypeError: Channel.send expects exactly 1 argument");
                    const argExpr = expr.args[0];
                    this.checkExpr(argExpr, env);
                    
                    if (argExpr.kind === "Identifier") {
                        const vInfo = env.get(argExpr.symbol);
                        if (vInfo && vInfo.isMut) {
                            env.markMoved(argExpr.symbol);
                        }
                    }
                    return { kind: "Void" };
                } else if (expr.caller.property === "recv") {
                    if (expr.args.length !== 0) throw new Error("TypeError: Channel.recv expects exactly 0 arguments");
                    return callerType.genericArgs.length > 0 ? callerType.genericArgs[0] : { kind: "Any" };
                }
            }
            // Método de instância de um tipo nativo: `server.route(...)`
            if (callerType.kind === "Struct") {
                const methodSig = this.nativeTypes
                    .get(callerType.name)
                    ?.methods?.find((m) => m.name === expr.caller.property);
                if (methodSig) {
                    return this.checkNativeCall(`${callerType.name}.${methodSig.name}`, methodSig, expr.args, env);
                }
            }
        }

        return { kind: "Any" };

      case "AssignmentExpr":
        const assignValueType = this.checkExpr(expr.value, env);
        let assigneeType: FlexType = { kind: "Any" };
        
        if (expr.assignee.kind === "Identifier") {
            const varData = env.get(expr.assignee.symbol);
            if (varData && !varData.isMut) {
                 throw new Error(`TypeError: Cannot assign twice to immutable variable '${expr.assignee.symbol}'`);
            }
            assigneeType = this.checkExpr(expr.assignee, env);
        } else if (expr.assignee.kind === "IndexExpr" || expr.assignee.kind === "MemberExpr") {
            let root = expr.assignee;
            while (root.kind === "MemberExpr" || root.kind === "IndexExpr") {
                root = root.object as any;
            }
            if (root.kind === "Identifier") {
                const rootData = env.get(root.symbol);
                if (rootData && !rootData.isMut) {
                    throw new Error(`TypeError: Cannot mutate property of immutable variable '${root.symbol}'`);
                }
            }
            assigneeType = this.checkExpr(expr.assignee, env);
        }

        if (!this.isTypeAssignable(assigneeType, assignValueType)) {
             throw new Error(`TypeError: Cannot assign ${this.typeToString(assignValueType)} to ${this.typeToString(assigneeType)}`);
        }
        return assignValueType;
        
      case "TryExpr":
        // `expected` repassado como está: para quem consome (`req.json()`), o
        // tipo esperado da expressão INTEIRA (o valor já desembrulhado pelo `?`)
        // é o mesmo tipo esperado da chamada por trás do `?`.
        const tryType = this.checkExpr(expr.expression, env, expected);
        if (tryType.kind === "Any") return { kind: "Any" };

        // Checagem estrutural: `?` é uma operação sobre os tipos embutidos, não
        // sobre "qualquer enum cuja primeira variante se chame Ok".
        if (tryType.kind !== "Enum" || !isBuiltinType(tryType.name)) {
            throw new Error(`TypeError: ? operator can only be applied to Result or Option, got ${this.typeToString(tryType)}`);
        }

        const currentReturn = env.get("__RETURN_TYPE__");
        if (currentReturn && currentReturn.type.kind !== "Any") {
            if (currentReturn.type.kind !== "Enum") {
                throw new Error(`TypeError: Cannot use ? operator in a function that returns ${this.typeToString(currentReturn.type)}`);
            }
            // O erro é propagado como está, então só cabe no retorno se for o mesmo tipo.
            if (currentReturn.type.name !== tryType.name) {
                throw new Error(`TypeError: Cannot use ? on ${tryType.name} in a function that returns ${this.typeToString(currentReturn.type)}`);
            }
            this.checkPropagatedPayload(tryType, currentReturn.type);
        }

        const tryDecl = this.enums.get(tryType.name)!;
        const okVariant = successVariant(tryDecl);
        if (okVariant && okVariant.payload && okVariant.payload.length > 0) {
            return this.resolveTypeNode(okVariant.payload[0], this.genericSubst(tryDecl, tryType.genericArgs));
        }
        return { kind: "Any" };

      case "LambdaExpr": {
        // Lambda: |param: Type, ...| { body }
        // Checa o corpo da lambda em um ambiente com os parâmetros definidos.
        // O tipo da lambda em si é Any — limitação conhecida, igual a closures
        // passadas como variável (o checker não modela tipos de função).
        const lambdaEnv = new TypeEnvironment(env);
        for (const param of expr.parameters) {
          lambdaEnv.define(param.name, this.resolveTypeNode(param.typeAnnotation), !!param.isMut);
        }
        this.checkStmt(expr.body, lambdaEnv);
        return { kind: "Any" };
      }

      default:
        return { kind: "Any" };
    }
  }

  // =========== UTILITÁRIOS ===========

  /**
   * @param subst substituição de parâmetros de tipo (ex: {T: Int, E: String} ao
   *              resolver o payload de uma variante de `Result<Int, String>`)
   */
  private resolveTypeNode(node: TypeNode, subst?: Map<string, FlexType>): FlexType {
    switch (node.kind) {
      case "NamedTypeNode":
        const bound = subst?.get(node.name);
        if (bound) return bound;
        if (node.name === "Int") return { kind: "Int" };
        if (node.name === "String") return { kind: "String" };
        if (node.name === "Bool") return { kind: "Bool" };
        if (this.enums.has(node.name)) return { kind: "Enum", name: node.name, genericArgs: [] };
        return { kind: "Struct", name: node.name, genericArgs: [] };

      case "ArrayTypeNode":
        return { kind: "Array", elementType: this.resolveTypeNode(node.elementType, subst) };

      case "GenericTypeNode":
        const genericArgs = node.typeArguments.map((t) => this.resolveTypeNode(t, subst));
        if (this.enums.has(node.name)) {
          return { kind: "Enum", name: node.name, genericArgs };
        }
        return { kind: "Struct", name: node.name, genericArgs };
    }
  }

  /**
   * Liga os parâmetros de tipo de um enum aos argumentos concretos daquela
   * instanciação. O que não foi informado vira `Any`, para não inventar tipo.
   */
  /**
   * Chamada a um método de módulo nativo. A validação é por aridade: os tipos
   * dos argumentos de métodos nativos continuam sem checagem, como antes desta
   * RFC — limitação conhecida, não regressão.
   */
  private checkNativeCall(
    label: string,
    signature: NativeSignature,
    args: Expr[],
    env: TypeEnvironment,
  ): FlexType {
    const min = signature.minArity ?? signature.arity ?? 0;
    const max = signature.maxArity ?? signature.arity ?? min;
    if (args.length < min || args.length > max) {
      const expected = min === max ? `exactly ${min} argument${min === 1 ? "" : "s"}` : `between ${min} and ${max} arguments`;
      throw new Error(`TypeError: ${label} expects ${expected}, got ${args.length}`);
    }
    for (const arg of args) {
      this.checkExpr(arg, env);
    }
    return signature.returns;
  }

  /**
   * O `?` devolve o payload de sucesso e propaga qualquer outra variante **como
   * está** — logo os parâmetros de tipo que essas variantes carregam (o `E` de
   * `Result<T, E>`) precisam caber no retorno da função. `Option.None` não carrega
   * nada, então propagar `Option<User>` de uma função `-> Option<String>` é seguro.
   */
  private checkPropagatedPayload(tryType: FlexType, returnType: FlexType): void {
    if (tryType.kind !== "Enum" || returnType.kind !== "Enum") return;
    const decl = this.enums.get(tryType.name);
    if (!decl) return;

    const success = successVariant(decl);
    const params = decl.typeParams ?? [];

    for (const variant of decl.variants) {
      if (variant === success) continue;
      for (const payload of variant.payload ?? []) {
        if (payload.kind !== "NamedTypeNode") continue;
        const position = params.indexOf(payload.name);
        if (position < 0) continue;

        const propagated = tryType.genericArgs[position];
        const expected = returnType.genericArgs[position];
        if (!propagated || !expected) continue;
        if (!this.isTypeAssignable(expected, propagated)) {
          throw new Error(
            `TypeError: ? propagates ${this.typeToString(tryType)}, which does not fit the return type ${this.typeToString(returnType)}`,
          );
        }
      }
    }
  }

  /**
   * Inferência na construção de uma variante: `Result.Ok(5)` diz que T é Int,
   * mas não diz nada sobre E — o que não dá para inferir fica `Any`.
   */
  private inferGenericArgs(
    decl: EnumDeclaration,
    payloadTypes: TypeNode[],
    argTypes: FlexType[],
  ): FlexType[] {
    return (decl.typeParams ?? []).map((param) => {
      const position = payloadTypes.findIndex(
        (node) => node.kind === "NamedTypeNode" && node.name === param,
      );
      const inferred = position >= 0 ? argTypes[position] : undefined;
      return inferred ?? { kind: "Any" };
    });
  }

  private genericSubst(decl: EnumDeclaration, genericArgs: FlexType[]): Map<string, FlexType> {
    const subst = new Map<string, FlexType>();
    for (const [i, param] of (decl.typeParams ?? []).entries()) {
      subst.set(param, genericArgs[i] ?? { kind: "Any" });
    }
    return subst;
  }

  private isTypeAssignable(target: FlexType, source: FlexType): boolean {
    if (target.kind === "Any" || source.kind === "Any") return true;
    if (target.kind !== source.kind) return false;

    if (target.kind === "Array" && source.kind === "Array") {
      return this.isTypeAssignable(target.elementType, source.elementType);
    }
    if (target.kind === "Struct" && source.kind === "Struct") {
      return target.name === source.name;
    }
    if (target.kind === "Enum" && source.kind === "Enum") {
      if (target.name !== source.name) return false;
      // Instanciações precisam ser compatíveis: Result<Int, String> não aceita
      // um Result<String, ...>. Argumento ausente ou Any casa com qualquer coisa.
      const arity = Math.max(target.genericArgs.length, source.genericArgs.length);
      for (let i = 0; i < arity; i++) {
        const targetArg = target.genericArgs[i];
        const sourceArg = source.genericArgs[i];
        if (!targetArg || !sourceArg) continue;
        if (!this.isTypeAssignable(targetArg, sourceArg)) return false;
      }
      return true;
    }
    return true;
  }

  private typeToString(type: FlexType): string {
    switch (type.kind) {
      case "Int": return "Int";
      case "String": return "String";
      case "Bool": return "Bool";
      case "Any": return "Any";
      case "Void": return "Void";
      case "Array": return `[${this.typeToString(type.elementType)}]`;
      case "Struct":
        if (type.genericArgs.length > 0) {
           return `${type.name}<${type.genericArgs.map(t => this.typeToString(t)).join(", ")}>`;
        }
        return type.name;
      case "Enum":
        if (type.genericArgs.length > 0) {
           return `${type.name}<${type.genericArgs.map(t => this.typeToString(t)).join(", ")}>`;
        }
        return type.name;
    }
  }
}
