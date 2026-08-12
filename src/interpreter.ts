import type { Stmt, Expr, FunctionDeclaration } from "./ast";

class Environment {
  private variables: Map<string, any> = new Map();

  constructor(public parent?: Environment) {}

  public define(name: string, value: any): void {
    this.variables.set(name, value);
  }

  public get(name: string): any {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    } else if (this.parent) {
      return this.parent.get(name);
    } else {
      throw new Error(`ReferenceError: Identifier '${name}' is not defined`);
    }
  }

  public assign(name: string, value: any): void {
    if (this.variables.has(name)) {
      this.variables.set(name, value);
    } else if (this.parent) {
      this.parent.assign(name, value);
    } else {
      throw new Error(`ReferenceError: Cannot assign to undefined variable '${name}'`);
    }
  }
}

class ReturnException {
  constructor(public value: any) {}
}

class FlexFunction {
  constructor(
    public declaration: FunctionDeclaration,
    public closure: Environment,
  ) {}
}

export class Interpreter {
  // Ambiente para armazenar variáveis na memória
  private globalEnv = new Environment();

  constructor(private stdout: (msg: string) => void = console.log) {}

  public run(program: Stmt[]) {
    for (const stmt of program) {
      this.evaluateStmt(stmt, this.globalEnv);
    }
  }

  private evaluateStmt(stmt: Stmt, env: Environment): void {
    switch (stmt.kind) {
      case "MatchStmt":
        const matchValue = this.evaluateExpr(stmt.value, env);
        if (typeof matchValue === "object" && matchValue !== null && matchValue.kind === "EnumVariant") {
            for (const arm of stmt.arms) {
                if (arm.enumName === matchValue.enumName && arm.variantName === matchValue.variantName) {
                    const armEnv = new Environment(env);
                    for (let i = 0; i < arm.binders.length; i++) {
                        armEnv.define(arm.binders[i], matchValue.payload[i]);
                    }
                    this.evaluateStmt(arm.body, armEnv);
                    return;
                }
            }
            throw new Error(`RuntimeError: No match arm found for ${matchValue.enumName}::${matchValue.variantName}`);
        }
        throw new Error("RuntimeError: Cannot match on non-enum value");
        
      case "EnumDeclaration":
        // Guardamos a declaracao para acesso em MemberExpr
        env.define(stmt.name, stmt);
        break;
        
      case "ExpressionStatement":
        this.evaluateExpr(stmt.expression, env);
        break;

      case "ImplDeclaration":
        // Guardamos a lista de métodos como FlexFunctions atrelada ao nome da Struct na memória global
        const flexMethods = stmt.methods.map(m => new FlexFunction(m, env));
        env.define(`impl_${stmt.structName}`, flexMethods);
        break;

      case "StructDeclaration":
        // Guardamos a definição da struct na memória (sem valor inicial, só o molde)
        env.define(stmt.name, stmt);
        break;
      case "FunctionDeclaration":
        // Guardamos a declaração envolta em uma closure (FlexFunction)
        const flexFunc = new FlexFunction(stmt, env);
        env.define(stmt.name, flexFunc);
        break;
      case "ReturnStmt":
        // Avalia o valor e lança a exceção controlada para interromper o fluxo
        const returnValue = stmt.value
          ? this.evaluateExpr(stmt.value, env)
          : null;
        throw new ReturnException(returnValue);
      case "VarDeclaration":
        const value = this.evaluateExpr(stmt.value, env);
        env.define(stmt.name, value);
        break;
      case "PrintStmt":
        const output = this.evaluateExpr(stmt.value, env);
        this.stdout(String(output));
        break;
      case "BlockStmt":
        // Cria um NOVO escopo isolado que herda do ambiente pai
        const blockEnv = new Environment(env);
        for (const blockStmt of stmt.body) {
          this.evaluateStmt(blockStmt, blockEnv);
        }
        break;
      case "IfStmt":
        const conditionValue = this.evaluateExpr(stmt.condition, env);
        if (conditionValue) {
          this.evaluateStmt(stmt.consequent, env);
        } else if (stmt.alternate) {
          this.evaluateStmt(stmt.alternate, env);
        }
        break;
      case "ForStmt":
        const startValue = this.evaluateExpr(stmt.start, env);
        const endValue = this.evaluateExpr(stmt.end, env);
        for (let i = startValue; i < endValue; i++) {
          // A cada iteração do loop, criamos um escopo limpo para não misturar os dados
          const loopEnv = new Environment(env);
          loopEnv.define(stmt.iteratorName, i);
          this.evaluateStmt(stmt.body, loopEnv);
        }
        break;
      case "WhileStmt":
        while (this.evaluateExpr(stmt.condition, env)) {
          const loopEnv = new Environment(env);
          this.evaluateStmt(stmt.body, loopEnv);
        }
        break;
      default:
        // O TS garante que tratamos todos os "kinds" de Stmt aqui
        throw new Error(`Statement not implemented in the interpreter`);
    }
  }

  private evaluateExpr(expr: Expr, env: Environment): any {
    switch (expr.kind) {
      case "AssignmentExpr":
        const assignValue = this.evaluateExpr(expr.value, env);
        if (expr.assignee.kind === "Identifier") {
          env.assign(expr.assignee.symbol, assignValue);
          return assignValue;
        } else if (expr.assignee.kind === "MemberExpr") {
          const objectInstance = this.evaluateExpr(expr.assignee.object, env);
          if (!(objectInstance instanceof Map)) {
            throw new Error("TypeError: Cannot assign to property on non-object.");
          }
          objectInstance.set(expr.assignee.property, assignValue);
          return assignValue;
        } else if (expr.assignee.kind === "IndexExpr") {
          const arrayInstance = this.evaluateExpr(expr.assignee.object, env);
          if (!Array.isArray(arrayInstance)) {
            throw new Error("TypeError: Cannot index into a non-array.");
          }
          const indexValue = this.evaluateExpr(expr.assignee.index, env);
          arrayInstance[indexValue] = assignValue;
          return assignValue;
        } else {
          throw new Error(`SyntaxError: Invalid assignment target`);
        }

      case "StructExpr":
        // 1. Validar se o molde da Struct existe na memória (Type Checking em tempo de execução)
        const structBlueprint = env.get(expr.structName);
        if (!structBlueprint || structBlueprint.kind !== "StructDeclaration") {
          throw new Error(
            `TypeError: Struct '${expr.structName}' not declared`,
          );
        }

        // 2. Criar a instância como um Mapa em memória
        const instance = new Map<string, any>();
        // TRUQUE: Guardamos uma propriedade invisível com o nome da Struct
        // para sabermos onde buscar os métodos dela depois
        instance.set("__structName", expr.structName);

        for (const prop of expr.properties) {
          const evalValue = this.evaluateExpr(prop.value, env);
          instance.set(prop.name, evalValue);
        }
        return instance;

      case "MemberExpr":
        const objectInstance = this.evaluateExpr(expr.object, env);
        if (typeof objectInstance === "object" && objectInstance !== null && objectInstance.kind === "EnumDeclaration") {
             // Retorna um construtor parcial de variante ou a própria variante vazia
             const variantName = expr.property;
             const variant = objectInstance.variants.find((v: any) => v.name === variantName);
             if (variant && (!variant.payload || variant.payload.length === 0)) {
                 return { kind: "EnumVariant", enumName: objectInstance.name, variantName, payload: [] };
             }
             return { __isEnumConstructor: true, enumName: objectInstance.name, variantName };
        }
        if (!(objectInstance instanceof Map)) {
          throw new Error("TypeError: Cannot access property on non-object.");
        }
        return objectInstance.get(expr.property);

      case "CallExpr":
        // 1. Verificamos se é a chamada de um MÉTODO (ex: p.sum())
        if (expr.caller.kind === "MemberExpr") {
          const objectInstance = this.evaluateExpr(expr.caller.object, env);
          
          // Se for Enum, repassa para a lógica geral de Call abaixo que captura __isEnumConstructor
          if (typeof objectInstance === "object" && objectInstance !== null && objectInstance.kind === "EnumDeclaration") {
              // Pula o bloco if de método.
          } else {
              if (!(objectInstance instanceof Map)) {
                throw new Error("TypeError: Cannot call a method on a non-object.");
              }

              // Lógica original de chamada de método...
              const structName = objectInstance.get("__structName");
              const methodMap = this.globalEnv.get(`impl_${structName}`);
              if (!methodMap) {
                throw new Error(`TypeError: No impl block found for ${structName}`);
              }
              const methodFunc = methodMap.find((m: any) => m.declaration.name === expr.caller.property);
              if (!methodFunc) {
                throw new Error(`TypeError: Method '${expr.caller.property}' not found`);
              }

              const args = expr.args.map((arg) => this.evaluateExpr(arg, env));
              const methodEnv = new Environment(methodFunc.closure);
              methodEnv.define("self", objectInstance);

              methodFunc.declaration.parameters.forEach((param: any, index: number) => {
                methodEnv.define(param.name, args[index]);
              });

              try {
                for (const blockStmt of methodFunc.declaration.body.body) {
                  this.evaluateStmt(blockStmt, methodEnv);
                }
              } catch (e) {
                if (e instanceof ReturnException) {
                  return e.value;
                }
                throw e;
              }
              return null;
          }
        }

        const func = this.evaluateExpr(expr.caller, env);

        if (func && func.__isEnumConstructor) {
             const args = expr.args.map((arg) => this.evaluateExpr(arg, env));
             return { kind: "EnumVariant", enumName: func.enumName, variantName: func.variantName, payload: args };
        }

        if (func instanceof FlexFunction) {
            // 2. avaliamos os argumentos passados
            const args = expr.args.map((arg) => this.evaluateExpr(arg, env));

            // 3. Criamos um NOVO escopo baseado no escopo onde a função foi DEFINIDA (Closure) real
            const functionEnv = new Environment(func.closure);

            // 4. Mapeamos os argumentos para os nomes dos parâmetros
            func.declaration.parameters.forEach((param, index) => {
              functionEnv.define(param.name, args[index]);
            });

            // 5. Executamos o corpo da função e capturamos o retorno
            try {
              for (const blockStmt of func.declaration.body.body) {
                this.evaluateStmt(blockStmt, functionEnv);
              }
            } catch (e) {
              if (e instanceof ReturnException) {
                return e.value; // Pega o valor e devolve para quem chamou!
              }
              throw e; // Se for um erro real, lança adiante!
            }
            return null; // Caso a função não tenha return
        }
        throw new Error(`TypeError: Not a function`);

      case "NumericLiteral":
        return expr.value;
      case "BooleanLiteral":
        return expr.value;
      case "StringLiteral":
        return expr.value;
      case "StringInterpolationExpr":
        return expr.parts.map(p => {
          if (typeof p === "string") return p;
          return String(this.evaluateExpr(p, env));
        }).join("");

      case "TryExpr":
        const tryValue = this.evaluateExpr(expr.expression, env);
        if (typeof tryValue === "object" && tryValue !== null && tryValue.kind === "EnumVariant") {
            if (tryValue.variantName === "Ok" || tryValue.variantName === "Some" || tryValue.variantName === "Sucesso") {
                return tryValue.payload.length > 0 ? tryValue.payload[0] : null;
            } else {
                // Propaga o erro retornado
                throw new ReturnException(tryValue);
            }
        }
        throw new Error("RuntimeError: Cannot apply ? operator to non-enum value");

      case "Identifier":
        const value = env.get(expr.symbol);
        if (value === undefined) {
          throw new Error(
            `ReferenceError: Identifier '${expr.symbol}' is not defined`,
          );
        }
        return value;
      case "LogicalExpr":
        const leftVal = this.evaluateExpr(expr.left, env);
        if (expr.operator === "&&") {
          if (!leftVal) return leftVal;
          return this.evaluateExpr(expr.right, env);
        } else if (expr.operator === "||") {
          if (leftVal) return leftVal;
          return this.evaluateExpr(expr.right, env);
        }
        throw new Error(`Unknown logical operator: ${expr.operator}`);
      case "UnaryExpr":
        const arg = this.evaluateExpr(expr.argument, env);
        if (expr.operator === "-") return -arg;
        if (expr.operator === "!") return !arg;
        throw new Error(`Unknown unary operator: ${expr.operator}`);
      case "ArrayLiteral":
        return expr.elements.map(e => this.evaluateExpr(e, env));
      case "IndexExpr":
        const obj = this.evaluateExpr(expr.object, env);
        const idx = this.evaluateExpr(expr.index, env);
        if (Array.isArray(obj)) {
          return obj[idx];
        } else {
          throw new Error("TypeError: Indexing is only supported on arrays.");
        }
      case "BinaryExpr":
        const left = this.evaluateExpr(expr.left, env);
        const right = this.evaluateExpr(expr.right, env);
        switch (expr.operator) {
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            return left / right;
          case "%":
            return left % right;
          case "==":
            return left === right;
          case "!=":
            return left !== right;
          case ">":
            return left > right;
          case "<":
            return left < right;
          case ">=":
            return left >= right;
          case "<=":
            return left <= right;
          default:
            throw new Error(`Unknown operator ${expr.operator}`);
        }
      default:
        throw new Error(`Expression not implemented in the interpreter`);
    }
  }
}
