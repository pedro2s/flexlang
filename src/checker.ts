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
  private inScopeContext: number = 0;

  public check(stmts: Stmt[]): void {
    // Primeira Passagem (Pass 1): Registrar declarações (Hoisting de Structs e Funcs)
    for (const stmt of stmts) {
      if (stmt.kind === "StructDeclaration") {
        this.structs.set(stmt.name, stmt);
      } else if (stmt.kind === "FunctionDeclaration") {
        this.functions.set(stmt.name, stmt);
      } else if (stmt.kind === "EnumDeclaration") {
        this.enums.set(stmt.name, stmt);
      } else if (stmt.kind === "TraitDeclaration") {
        this.traits.set(stmt.name, stmt);
      } else if (stmt.kind === "ImportDeclaration") {
        if (stmt.moduleName === "\"net/http\"") {
             this.structs.set("Server", { kind: "StructDeclaration", name: "Server", properties: [] });
             this.structs.set("Request", { kind: "StructDeclaration", name: "Request", properties: [] });
             this.structs.set("Response", { kind: "StructDeclaration", name: "Response", properties: [] });
        } else {
             throw new Error(`ImportError: Module '${stmt.moduleName}' not found`);
        }
      }
    }

    // Segunda Passagem (Pass 2): Checagem profunda
    for (const stmt of stmts) {
      this.checkStmt(stmt, this.env);
    }
  }

  // =========== CHECAGEM DE STATEMENTS ===========

  private checkStmt(stmt: Stmt, env: TypeEnvironment): void {
    switch (stmt.kind) {
      case "VarDeclaration":
        const valueType = this.checkExpr(stmt.value, env);
        let declaredType: FlexType | undefined = undefined;

        if (stmt.typeAnnotation) {
          declaredType = this.resolveTypeNode(stmt.typeAnnotation);
          if (!this.isTypeAssignable(declaredType, valueType)) {
            throw new Error(
              `TypeError: Cannot assign value of type '${this.typeToString(valueType)}' to variable '${stmt.name}' of type '${this.typeToString(declaredType)}'`,
            );
          }
        } else {
          // Inferência Local
          declaredType = valueType;
        }
        env.define(stmt.name, declaredType, stmt.isMut);
        break;

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
          this.checkExpr(stmt.value, env);
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
                 mEnv.define(param.name, this.resolveTypeNode(param.typeAnnotation), !!param.isMut);
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
            
            const armEnv = new TypeEnvironment(env);
            for (let i = 0; i < arm.binders.length; i++) {
                 armEnv.define(arm.binders[i], this.resolveTypeNode(payloadTypes[i]), false);
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

  private checkExpr(expr: Expr, env: TypeEnvironment): FlexType {
    switch (expr.kind) {
      case "NumericLiteral":
        return { kind: "Int" };
      case "BooleanLiteral":
        return { kind: "Bool" };
      case "StringLiteral":
      case "StringInterpolationExpr":
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
        // Checagem básica
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
             return { kind: "Enum", name: enumName, genericArgs: [] };
        }
        // Pula checagem complexa por enquanto
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
             
             for (let i = 0; i < expr.args.length; i++) {
                 const argType = this.checkExpr(expr.args[i], env);
                 const expectedType = this.resolveTypeNode(payloadTypes[i]);
                 if (!this.isTypeAssignable(expectedType, argType)) {
                      throw new Error(`TypeError: Argument ${i+1} of variant '${variantName}' must be ${this.typeToString(expectedType)}, got ${this.typeToString(argType)}`);
                 }
             }
             return { kind: "Enum", name: enumName, genericArgs: [] };
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
            if (expr.caller.object.kind === "Identifier" && expr.caller.object.symbol === "Channel" && expr.caller.property === "new") {
                return { kind: "Struct", name: "Channel", genericArgs: [{ kind: "Any" }] };
            }
            if (expr.caller.object.kind === "Identifier" && expr.caller.object.symbol === "Server" && expr.caller.property === "new") {
                if (expr.args.length !== 1) throw new Error("TypeError: Server.new expects exactly 1 argument (address)");
                this.checkExpr(expr.args[0], env);
                return { kind: "Struct", name: "Server", genericArgs: [] };
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
            if (callerType.kind === "Struct" && callerType.name === "Server") {
                if (expr.caller.property === "route") {
                    if (expr.args.length !== 2) throw new Error("TypeError: Server.route expects exactly 2 arguments");
                    this.checkExpr(expr.args[0], env);
                    this.checkExpr(expr.args[1], env);
                    return { kind: "Void" };
                } else if (expr.caller.property === "start") {
                    if (expr.args.length !== 0) throw new Error("TypeError: Server.start expects exactly 0 arguments");
                    return { kind: "Void" };
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
        const tryType = this.checkExpr(expr.expression, env);
        if (tryType.kind !== "Enum" && tryType.kind !== "Any") {
            throw new Error(`TypeError: ? operator can only be applied to Enums (like Result or Option), got ${this.typeToString(tryType)}`);
        }
        
        const currentReturn = env.get("__RETURN_TYPE__");
        if (currentReturn && tryType.kind === "Enum") {
            if (currentReturn.type.kind !== "Enum" && currentReturn.type.kind !== "Any") {
                throw new Error(`TypeError: Cannot use ? operator in a function that returns ${this.typeToString(currentReturn.type)}`);
            }
        }
        
        if (tryType.kind === "Enum") {
            const eDecl = this.enums.get(tryType.name);
            if (eDecl) {
                const okVariant = eDecl.variants.find(v => v.name === "Ok" || v.name === "Some" || v.name === "Sucesso");
                if (okVariant && okVariant.payload && okVariant.payload.length > 0) {
                     return this.resolveTypeNode(okVariant.payload[0]);
                }
            }
        }
        return { kind: "Any" };

      default:
        return { kind: "Any" };
    }
  }

  // =========== UTILITÁRIOS ===========

  private resolveTypeNode(node: TypeNode): FlexType {
    switch (node.kind) {
      case "NamedTypeNode":
        if (node.name === "Int") return { kind: "Int" };
        if (node.name === "String") return { kind: "String" };
        if (node.name === "Bool") return { kind: "Bool" };
        if (this.enums.has(node.name)) return { kind: "Enum", name: node.name, genericArgs: [] };
        return { kind: "Struct", name: node.name, genericArgs: [] };

      case "ArrayTypeNode":
        return { kind: "Array", elementType: this.resolveTypeNode(node.elementType) };

      case "GenericTypeNode":
        return {
          kind: "Struct",
          name: node.name,
          genericArgs: node.typeArguments.map((t) => this.resolveTypeNode(t)),
        };
    }
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
      return target.name === source.name;
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
