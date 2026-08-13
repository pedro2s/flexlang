import type { Stmt, Expr, FunctionDeclaration } from "./ast";
import { builtinEnums, isBuiltinType, isSuccessVariant } from "./stdlib";
import { registry } from "./modules/registry";
import { NATIVE_TAG, isNativeObject, modulePath, nativeMethod } from "./modules/types";

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

  public has(name: string): boolean {
    if (this.variables.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
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

/** Canal síncrono. Primitivo da linguagem: existe sem import, como `scope`/`spawn`. */
class FlexChannel {
  readonly [NATIVE_TAG] = "Channel";
  private queue: any[] = [];
  private receivers: ((val: any) => void)[] = [];

  public async send(val: any): Promise<void> {
    if (this.receivers.length > 0) {
      const resolve = this.receivers.shift()!;
      resolve(val);
      return;
    }
    
    // Como é um channel capacity=0 (síncrono), temos que aguardar alguém ler!
    return new Promise((resolve) => {
      this.queue.push({ val, resolveSend: resolve });
    });
  }

  public async recv(): Promise<any> {
    if (this.queue.length > 0) {
      const item = this.queue.shift()!;
      item.resolveSend();
      return item.val;
    }
    
    return new Promise((resolve) => {
      this.receivers.push(resolve);
    });
  }
}

export class Interpreter {
  // Ambiente para armazenar variáveis na memória
  private globalEnv = new Environment();

  constructor(private stdout: (msg: string) => void = console.log) {
    // Result e Option existem em todo programa, sem declaração (RFC-002).
    for (const builtin of builtinEnums()) {
      this.globalEnv.define(builtin.name, builtin);
    }
  }

  public async run(program: Stmt[]) {
    for (const stmt of program) {
      await this.evaluateStmt(stmt, this.globalEnv);
    }
  }

  /**
   * Executa uma função FlexLang com argumentos já avaliados. É por aqui que um
   * módulo nativo chama de volta o código do usuário (ex: o handler de uma rota
   * HTTP), sem precisar do ambiente interno do interpretador.
   */
  public async callFunction(fn: unknown, args: any[]): Promise<any> {
    if (!(fn instanceof FlexFunction)) {
      throw new Error("TypeError: Not a function");
    }

    // Escopo novo a partir de onde a função foi DEFINIDA (closure real)
    const functionEnv = new Environment(fn.closure);
    fn.declaration.parameters.forEach((param, index) => {
      functionEnv.define(param.name, args[index]);
    });

    try {
      for (const stmt of fn.declaration.body.body) {
        await this.evaluateStmt(stmt, functionEnv);
      }
    } catch (e) {
      if (e instanceof ReturnException) {
        return e.value; // Pega o valor e devolve para quem chamou!
      }
      throw e; // Se for um erro real, lança adiante!
    }
    return null; // Caso a função não tenha return
  }

  private async evaluateStmt(stmt: Stmt, env: Environment): Promise<void> {
    switch (stmt.kind) {
      case "ScopeStmt":
        const scopeEnv = new Environment(env);
        // Lista de promessas onde as "green threads" (spawns) vão se registrar
        const spawnPromises: Promise<void>[] = [];
        scopeEnv.define("__scope_promises__", spawnPromises);

        // Executa o corpo síncrono/assíncrono do escopo (que pode disparar os spawns)
        await this.evaluateStmt(stmt.body, scopeEnv);

        // Aguarda todos os filhos terminarem. Se houver deadline, cria uma corrida (race)
        if (stmt.deadline) {
          const deadlineValue = await this.evaluateExpr(stmt.deadline, env);
          const timeoutPromise = new Promise<void>((_, reject) => 
              setTimeout(() => reject(new Error("TimeoutError: Scope deadline exceeded")), deadlineValue)
          );
          await Promise.race([Promise.all(spawnPromises), timeoutPromise]);
        } else {
          await Promise.all(spawnPromises);
        }
        break;

      case "SpawnStmt":
        // Busca a lista de promessas do escopo mais próximo
        let currentEnv: Environment | undefined = env;
        let promisesList: Promise<void>[] | null = null;
        while (currentEnv) {
          if (currentEnv.has("__scope_promises__")) {
             promisesList = currentEnv.get("__scope_promises__");
             break;
          }
          currentEnv = currentEnv.parent;
        }

        if (!promisesList) {
          throw new Error("RuntimeError: spawn called outside of a scope block");
        }

        const spawnEnv = new Environment(env);
        // Dispara a rotina assincronamente e não aguarda aqui! (Goroutine style)
        const task = (async () => {
             await this.evaluateStmt(stmt.body, spawnEnv);
        })();
        promisesList.push(task);
        break;

      case "MatchStmt":
        const matchValue = await this.evaluateExpr(stmt.value, env);
        if (typeof matchValue === "object" && matchValue !== null && matchValue.kind === "EnumVariant") {
            for (const arm of stmt.arms) {
                if (arm.enumName === matchValue.enumName && arm.variantName === matchValue.variantName) {
                    const armEnv = new Environment(env);
                    for (let i = 0; i < arm.binders.length; i++) {
                        armEnv.define(arm.binders[i], matchValue.payload[i]);
                    }
                    await this.evaluateStmt(arm.body, armEnv);
                    return;
                }
            }
            throw new Error(`RuntimeError: No match arm found for ${matchValue.enumName}.${matchValue.variantName}`);
        }
        throw new Error("RuntimeError: Cannot match on non-enum value");
        
      case "EnumDeclaration":
        // Guardamos a declaracao para acesso em MemberExpr
        env.define(stmt.name, stmt);
        break;
        
      case "ExpressionStatement":
        await this.evaluateExpr(stmt.expression, env);
        break;

      case "ImplDeclaration":
        // Guardamos a lista de métodos como FlexFunctions atrelada ao nome da Struct na memória global
        const flexMethods = stmt.methods.map(m => new FlexFunction(m, env));
        env.define(`impl_${stmt.structName}`, flexMethods);
        break;

      case "StructDeclaration":
        env.define(stmt.name, stmt);
        break;
      case "TraitDeclaration":
        // Apenas definição
        break;

      case "ImportDeclaration": {
        // O módulo nativo injeta seus valores no ambiente (RFC-003)
        const path = modulePath(stmt.moduleName);
        const mod = registry.get(path);
        if (!mod) {
          throw new Error(`ImportError: Module '${path}' not found`);
        }
        for (const [name, binding] of Object.entries(mod.runtimeBinding(this))) {
          env.define(name, binding);
        }
        break;
      }
      case "FunctionDeclaration":
        // Guardamos a declaração envolta em uma closure (FlexFunction)
        const flexFunc = new FlexFunction(stmt, env);
        env.define(stmt.name, flexFunc);
        break;
      case "ReturnStmt":
        // Avalia o valor e lança a exceção controlada para interromper o fluxo
        const returnValue = stmt.value
          ? await this.evaluateExpr(stmt.value, env)
          : null;
        throw new ReturnException(returnValue);
      case "VarDeclaration":
        const value = await this.evaluateExpr(stmt.value, env);
        env.define(stmt.name, value);
        break;
      case "PrintStmt":
        const output = await this.evaluateExpr(stmt.value, env);
        this.stdout(String(output));
        break;
      case "BlockStmt":
        // Cria um NOVO escopo isolado que herda do ambiente pai
        const blockEnv = new Environment(env);
        for (const blockStmt of stmt.body) {
          await this.evaluateStmt(blockStmt, blockEnv);
        }
        break;
      case "IfStmt":
        const conditionValue = await this.evaluateExpr(stmt.condition, env);
        if (conditionValue) {
          await this.evaluateStmt(stmt.consequent, env);
        } else if (stmt.alternate) {
          await this.evaluateStmt(stmt.alternate, env);
        }
        break;
      case "ForStmt":
        const startValue = await this.evaluateExpr(stmt.start, env);
        const endValue = await this.evaluateExpr(stmt.end, env);
        for (let i = startValue; i < endValue; i++) {
          // A cada iteração do loop, criamos um escopo limpo para não misturar os dados
          const loopEnv = new Environment(env);
          loopEnv.define(stmt.iteratorName, i);
          await this.evaluateStmt(stmt.body, loopEnv);
        }
        break;
      case "WhileStmt":
        while (await this.evaluateExpr(stmt.condition, env)) {
          const loopEnv = new Environment(env);
          await this.evaluateStmt(stmt.body, loopEnv);
        }
        break;
      default:
        // O TS garante que tratamos todos os "kinds" de Stmt aqui
        throw new Error(`Statement not implemented in the interpreter`);
    }
  }

  private async evaluateExpr(expr: Expr, env: Environment): Promise<any> {
    switch (expr.kind) {
      case "AssignmentExpr":
        const assignValue = await this.evaluateExpr(expr.value, env);
        if (expr.assignee.kind === "Identifier") {
          env.assign(expr.assignee.symbol, assignValue);
          return assignValue;
        } else if (expr.assignee.kind === "MemberExpr") {
          const objectInstance = await this.evaluateExpr(expr.assignee.object, env);
          if (!(objectInstance instanceof Map)) {
            throw new Error("TypeError: Cannot assign to property on non-object.");
          }
          objectInstance.set(expr.assignee.property, assignValue);
          return assignValue;
        } else if (expr.assignee.kind === "IndexExpr") {
          const arrayInstance = await this.evaluateExpr(expr.assignee.object, env);
          if (!Array.isArray(arrayInstance)) {
            throw new Error("TypeError: Cannot index into a non-array.");
          }
          const indexValue = await this.evaluateExpr(expr.assignee.index, env);
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
          const evalValue = await this.evaluateExpr(prop.value, env);
          instance.set(prop.name, evalValue);
        }
        return instance;

      case "MemberExpr":
        const objectInstance = await this.evaluateExpr(expr.object, env);
        if (typeof objectInstance === "object" && objectInstance !== null && objectInstance.kind === "EnumDeclaration") {
             // Retorna um construtor parcial de variante ou a própria variante vazia
             const variantName = expr.property;
             const variant = objectInstance.variants.find((v: any) => v.name === variantName);
             if (variant && (!variant.payload || variant.payload.length === 0)) {
                 return { kind: "EnumVariant", enumName: objectInstance.name, variantName, payload: [] };
             }
             return { __isEnumConstructor: true, enumName: objectInstance.name, variantName };
        }
        if (isNativeObject(objectInstance)) {
          return objectInstance[expr.property];
        }
        if (!(objectInstance instanceof Map)) {
          throw new Error("TypeError: Cannot access property on non-object.");
        }
        return objectInstance.get(expr.property);

      case "CallExpr":
        // 1. Verificamos se é a chamada de um MÉTODO (ex: p.sum())
        if (expr.caller.kind === "MemberExpr") {
          
          // Channel é primitivo da linguagem: existe sem import
          if (expr.caller.object.kind === "Identifier" && expr.caller.object.symbol === "Channel" && expr.caller.property === "new") {
              return new FlexChannel();
          }

          const objectInstanceCall = await this.evaluateExpr(expr.caller.object, env);

          // Chamada nativa (construtor estático de módulo, método de canal, de
          // servidor...): todo objeto nativo expõe seus métodos como funções,
          // então um caminho só atende a todos os módulos.
          const native = nativeMethod(objectInstanceCall, expr.caller.property);
          if (native) {
              const args = [];
              for (const arg of expr.args) {
                  args.push(await this.evaluateExpr(arg, env));
              }
              return await native(...args);
          }

          // Tratamento de metodos dinâmicos (como res.json)
          if (objectInstanceCall instanceof Map && objectInstanceCall.has(expr.caller.property)) {
              const dynMethod = objectInstanceCall.get(expr.caller.property);
              if (typeof dynMethod === "function") {
                  const args = [];
                  for (const arg of expr.args) {
                      args.push(await this.evaluateExpr(arg, env));
                  }
                  return dynMethod(...args);
              }
          }
          
          // Se for Enum, repassa para a lógica geral de Call abaixo que captura __isEnumConstructor
          if (typeof objectInstanceCall === "object" && objectInstanceCall !== null && objectInstanceCall.kind === "EnumDeclaration") {
              // Pula o bloco if de método.
          } else {
              if (!(objectInstanceCall instanceof Map)) {
                throw new Error("TypeError: Cannot call a method on a non-object.");
              }

              // Lógica original de chamada de método...
              const structName = objectInstanceCall.get("__structName");
              const methodMap = this.globalEnv.get(`impl_${structName}`);
              if (!methodMap) {
                throw new Error(`TypeError: No impl block found for ${structName}`);
              }
              const methodFunc = methodMap.find((m: any) => m.declaration.name === (expr.caller as any).property);
              if (!methodFunc) {
                throw new Error(`TypeError: Method '${(expr.caller as any).property}' not found`);
              }

              const args = [];
              for (const arg of expr.args) {
                  args.push(await this.evaluateExpr(arg, env));
              }
              
              const methodEnv = new Environment(methodFunc.closure);
              methodEnv.define("self", objectInstanceCall);

              let argOffset = 0;
              if (methodFunc.declaration.parameters.length > 0 && methodFunc.declaration.parameters[0].name === "self") {
                  argOffset = 1;
              }

              methodFunc.declaration.parameters.forEach((param: any, index: number) => {
                if (param.name !== "self") {
                    methodEnv.define(param.name, args[index - argOffset]);
                }
              });

              try {
                for (const blockStmt of methodFunc.declaration.body.body) {
                  await this.evaluateStmt(blockStmt, methodEnv);
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

        const func = await this.evaluateExpr(expr.caller, env);

        if (func && func.__isEnumConstructor) {
             const args = [];
             for (const arg of expr.args) {
                  args.push(await this.evaluateExpr(arg, env));
             }
             return { kind: "EnumVariant", enumName: func.enumName, variantName: func.variantName, payload: args };
        }

        if (func instanceof FlexFunction) {
            // 2. avaliamos os argumentos passados
            const args = [];
            for (const arg of expr.args) {
                 args.push(await this.evaluateExpr(arg, env));
            }
            return await this.callFunction(func, args);
        }
        throw new Error(`TypeError: Not a function`);

      case "NumericLiteral":
        return expr.value;
      case "BooleanLiteral":
        return expr.value;
      case "StringLiteral":
        return expr.value;
      case "StringInterpolationExpr":
        const parts = [];
        for (const p of expr.parts) {
            if (typeof p === "string") {
                parts.push(p);
            } else {
                parts.push(String(await this.evaluateExpr(p, env)));
            }
        }
        return parts.join("");

      case "TryExpr":
        const tryValue = await this.evaluateExpr(expr.expression, env);
        if (
          typeof tryValue === "object" &&
          tryValue !== null &&
          tryValue.kind === "EnumVariant" &&
          isBuiltinType(tryValue.enumName)
        ) {
            if (isSuccessVariant(tryValue.enumName, tryValue.variantName)) {
                return tryValue.payload.length > 0 ? tryValue.payload[0] : null;
            }
            // Qualquer outra variante (Err/None) é propagada como está
            throw new ReturnException(tryValue);
        }
        throw new Error("RuntimeError: ? operator can only be applied to Result or Option");

      case "Identifier":
        const value = env.get(expr.symbol);
        if (value === undefined) {
          throw new Error(
            `ReferenceError: Identifier '${expr.symbol}' is not defined`,
          );
        }
        return value;
      case "LogicalExpr":
        const leftVal = await this.evaluateExpr(expr.left, env);
        if (expr.operator === "&&") {
          if (!leftVal) return leftVal;
          return await this.evaluateExpr(expr.right, env);
        } else if (expr.operator === "||") {
          if (leftVal) return leftVal;
          return await this.evaluateExpr(expr.right, env);
        }
        throw new Error(`Unknown logical operator: ${expr.operator}`);
      case "UnaryExpr":
        const arg = await this.evaluateExpr(expr.argument, env);
        if (expr.operator === "-") return -arg;
        if (expr.operator === "!") return !arg;
        throw new Error(`Unknown unary operator: ${expr.operator}`);
      case "ArrayLiteral":
        const elements = [];
        for (const e of expr.elements) {
             elements.push(await this.evaluateExpr(e, env));
        }
        return elements;
      case "IndexExpr":
        const obj = await this.evaluateExpr(expr.object, env);
        const idx = await this.evaluateExpr(expr.index, env);
        if (Array.isArray(obj)) {
          return obj[idx];
        } else {
          throw new Error("TypeError: Indexing is only supported on arrays.");
        }
      case "BinaryExpr":
        const left = await this.evaluateExpr(expr.left, env);
        const right = await this.evaluateExpr(expr.right, env);
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
