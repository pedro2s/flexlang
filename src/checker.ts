import type {
  Expr,
  Stmt,
  TypeNode,
  StructDeclaration,
  FunctionDeclaration,
} from "./ast";

// --- Representação Interna de Tipos do TypeChecker ---
export type FlexType =
  | { kind: "Int" }
  | { kind: "String" }
  | { kind: "Bool" }
  | { kind: "Array"; elementType: FlexType }
  | { kind: "Struct"; name: string; genericArgs: FlexType[] }
  | { kind: "Void" }
  | { kind: "Any" }; // Usado quando falha a inferência para evitar de dar 'cascade' de erros

// --- Ambiente de Tipos (Environment para checagem estática) ---
class TypeEnvironment {
  private variables = new Map<string, FlexType>();

  constructor(private enclosing?: TypeEnvironment) {}

  define(name: string, type: FlexType): void {
    this.variables.set(name, type);
  }

  get(name: string): FlexType | undefined {
    if (this.variables.has(name)) {
      return this.variables.get(name)!;
    }
    if (this.enclosing) {
      return this.enclosing.get(name);
    }
    return undefined;
  }
}

// --- O Type Checker Central ---
export class TypeChecker {
  private env = new TypeEnvironment();
  // Globais como Structs e Functions para checagem de tipos
  private structs = new Map<string, StructDeclaration>();
  private functions = new Map<string, FunctionDeclaration>();

  public check(stmts: Stmt[]): void {
    // Primeira Passagem (Pass 1): Registrar declarações (Hoisting de Structs e Funcs)
    for (const stmt of stmts) {
      if (stmt.kind === "StructDeclaration") {
        this.structs.set(stmt.name, stmt);
      } else if (stmt.kind === "FunctionDeclaration") {
        this.functions.set(stmt.name, stmt);
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
        env.define(stmt.name, declaredType);
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
        forEnv.define(stmt.iteratorName, { kind: "Int" });
        this.checkStmt(stmt.body, forEnv);
        break;

      case "FunctionDeclaration":
        // Registra a função local/closure para permitir Type Checking das suas chamadas mais abaixo
        this.functions.set(stmt.name, stmt);
        
        const funcEnv = new TypeEnvironment(env);
        for (const param of stmt.parameters) {
          funcEnv.define(param.name, this.resolveTypeNode(param.typeAnnotation));
        }
        this.checkStmt(stmt.body, funcEnv);
        break;

      case "ReturnStmt":
        if (stmt.value) {
          this.checkExpr(stmt.value, env);
        }
        break;

      case "StructDeclaration":
      case "ImplDeclaration":
        // Já hookado no Pass 1, ou faremos checkMethods aqui
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
        const type = env.get(expr.symbol);
        if (!type) {
          throw new Error(`ReferenceError: Variable '${expr.symbol}' not found`);
        }
        return type;

      case "BinaryExpr":
        const leftType = this.checkExpr(expr.left, env);
        const rightType = this.checkExpr(expr.right, env);
        
        // Verificaçôes simplificadas de relacional e igualdade
        if (["==", "!=", "<", "<=", ">", ">="].includes(expr.operator)) {
            return { kind: "Bool" };
        }
        
        // Matemático
        if (leftType.kind !== "Int" || rightType.kind !== "Int") {
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
        // Pula checagem complexa por enquanto
        return { kind: "Any" };

      case "CallExpr":
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
        return { kind: "Any" };

      case "AssignmentExpr":
        const assignValueType = this.checkExpr(expr.value, env);
        let assigneeType: FlexType = { kind: "Any" };
        
        if (expr.assignee.kind === "Identifier") {
            assigneeType = this.checkExpr(expr.assignee, env);
        } else if (expr.assignee.kind === "IndexExpr" || expr.assignee.kind === "MemberExpr") {
            assigneeType = this.checkExpr(expr.assignee, env);
        }

        if (!this.isTypeAssignable(assigneeType, assignValueType)) {
             throw new Error(`TypeError: Cannot assign ${this.typeToString(assignValueType)} to ${this.typeToString(assigneeType)}`);
        }
        return assignValueType;
        
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
    }
  }
}
