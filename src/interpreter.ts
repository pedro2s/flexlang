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

  public run(program: Stmt[]) {
    for (const stmt of program) {
      this.evaluateStmt(stmt, this.globalEnv);
    }
  }

  private evaluateStmt(stmt: Stmt, env: Environment): void {
    switch (stmt.kind) {
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
        console.log(this.evaluateExpr(stmt.value, env));
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
        // 1. Avalia quem é o objeto (ex: descobre que 'p' é um Map)
        const objectInstance = this.evaluateExpr(expr.object, env);

        // 2. Busca o valor da propriedade
        if (
          objectInstance instanceof Map &&
          objectInstance.has(expr.property)
        ) {
          return objectInstance.get(expr.property);
        }

        throw new Error(
          `ReferenceError: Property '${expr.property}' does not exist`,
        );

      case "CallExpr":
        // 1. Verificamos se é a chamada de um MÉTODO (ex: p.sum())
        if (expr.caller.kind === "MemberExpr") {
          // 'p' (o objeto instanciado na memória)
          const objInstance = this.evaluateExpr(expr.caller.object, env);
          const methodName = expr.caller.property; // 'sum'

          if (!(objInstance instanceof Map)) {
            throw new Error("TypeError: Cannot call a method on a non-object.");
          }

          const structName = objInstance.get("__structName");

          // 2. Buscamos a definição de método correspondente
          const methods = this.globalEnv.get(`impl_${structName}`);
          const methodFunc = methods.find(
            (m: any) => m.declaration.name === methodName,
          );

          if (!methodFunc) {
            throw new Error(
              `TypeError: Method '${methodName}' not found on struct '${structName}'`,
            );
          }

          // 3. Preparamos os argumentos
          const args = expr.args.map((arg) => this.evaluateExpr(arg, env));

          // 4. O SEGREDO DO OOP: Criamos um escopo isolado baseado na closure do método e injetamos 'self'
          const methodEnv = new Environment(methodFunc.closure);
          methodEnv.define("self", objInstance);

          methodFunc.declaration.parameters.forEach((param: any, index: number) => {
            methodEnv.define(param.name, args[index]);
          });

          // 4. Executamos
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

        // 1. Descobrimos qual função está sendo chamada
        const func = this.evaluateExpr(
          expr.caller,
          env,
        );

        if (!(func instanceof FlexFunction)) {
          throw new Error(`TypeError: Not a function`);
        }

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
      case "NumericLiteral":
        return expr.value;
      case "StringLiteral":
        return expr.value;
      case "Identifier":
        const value = env.get(expr.symbol);
        if (value === undefined) {
          throw new Error(
            `ReferenceError: Identifier '${expr.symbol}' is not defined`,
          );
        }
        return value;
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
