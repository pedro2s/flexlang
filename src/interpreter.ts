import type { Stmt, Expr, FunctionDeclaration } from "./ast";
import {
  builtinEnums,
  isBuiltinType,
  isSuccessVariant,
  optionSome,
  optionNone,
  resultOk,
  resultErr,
} from "./stdlib";
import { registry } from "./modules/registry";
import { NATIVE_TAG, isNativeObject, modulePath, nativeMethod } from "./modules/types";
import { type ModuleGraph, isLocalModule } from "./loader";
import { TypeChecker, type TypeMap } from "./checker";

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

class BreakException {}

class ContinueException {}

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
  private types: TypeMap = new Map();

  constructor(
    private stdout: (msg: string) => void = console.log,
    types?: TypeMap,
  ) {
    if (types) this.types = types;
    // Result e Option existem em todo programa, sem declaração (RFC-002).
    for (const builtin of builtinEnums()) {
      this.globalEnv.define(builtin.name, builtin);
    }
  }

  public async run(program: Stmt[] | ModuleGraph, types?: TypeMap) {
    if (types) {
      this.types = types;
    } else if (this.types.size === 0) {
      try {
        const checker = new TypeChecker();
        this.types = checker.check(program);
      } catch {
        // Se a checagem estática falhar, prossegue sem type map
      }
    }

    if (Array.isArray(program)) {
      for (const stmt of program) {
        await this.evaluateStmt(stmt, this.globalEnv);
      }
    } else {
      for (const filePath of program.order) {
        const sourceFile = program.files.get(filePath)!;
        for (const stmt of sourceFile.ast) {
          await this.evaluateStmt(stmt, this.globalEnv);
        }
      }
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
             try {
                 await this.evaluateStmt(stmt.body, spawnEnv);
             } catch (e: any) {
                 const entry = {
                     level: "error",
                     msg: "panic in spawned task",
                     panic: e.message || String(e),
                     ts: new Date().toISOString(),
                 };
                 console.log(JSON.stringify(entry));
             }
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
        if (isLocalModule(stmt.moduleName)) {
          // Módulos locais têm suas declarações avaliadas na ordem topológica
          break;
        }
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
        this.stdout(this.formatOutput(output));
        break;
      case "BlockStmt":
        // Cria um NOVO escopo isolado que herda do ambiente pai
        const blockEnv = new Environment(env);
        for (const blockStmt of stmt.body) {
          await this.evaluateStmt(blockStmt, blockEnv);
        }
        break;
      case "BreakStmt":
        throw new BreakException();
      case "ContinueStmt":
        throw new ContinueException();
      case "IfStmt":
        const conditionValue = await this.evaluateExpr(stmt.condition, env);
        if (conditionValue) {
          await this.evaluateStmt(stmt.consequent, env);
        } else if (stmt.alternate) {
          await this.evaluateStmt(stmt.alternate, env);
        }
        break;
      case "ForStmt":
        if (stmt.iterable.kind === "RangeExpr") {
          const startValue = await this.evaluateExpr(stmt.iterable.start, env);
          const endValue = await this.evaluateExpr(stmt.iterable.end, env);
          let idx = 0;
          for (let i = startValue; i < endValue; i++, idx++) {
            // A cada iteração do loop, criamos um escopo limpo para não misturar os dados
            const loopEnv = new Environment(env);
            loopEnv.define(stmt.iteratorName, i);
            if (stmt.indexName) {
              loopEnv.define(stmt.indexName, idx);
            }
            try {
              await this.evaluateStmt(stmt.body, loopEnv);
            } catch (e) {
              if (e instanceof BreakException) break;
              if (e instanceof ContinueException) continue;
              throw e;
            }
          }
        } else {
          const collection = await this.evaluateExpr(stmt.iterable, env);
          if (Array.isArray(collection) || typeof collection === "string") {
            for (let i = 0; i < collection.length; i++) {
              const loopEnv = new Environment(env);
              loopEnv.define(stmt.iteratorName, collection[i]);
              if (stmt.indexName) {
                loopEnv.define(stmt.indexName, i);
              }
              try {
                await this.evaluateStmt(stmt.body, loopEnv);
              } catch (e) {
                if (e instanceof BreakException) break;
                if (e instanceof ContinueException) continue;
                throw e;
              }
            }
          } else if (collection instanceof Map) {
            for (const [key, value] of collection.entries()) {
              const loopEnv = new Environment(env);
              loopEnv.define(stmt.iteratorName, key);
              if (stmt.indexName) {
                loopEnv.define(stmt.indexName, value);
              }
              try {
                await this.evaluateStmt(stmt.body, loopEnv);
              } catch (e) {
                if (e instanceof BreakException) break;
                if (e instanceof ContinueException) continue;
                throw e;
              }
            }
          } else {
            throw new Error(`TypeError: Value of type '${typeof collection}' is not iterable`);
          }
        }
        break;
      case "WhileStmt":
        while (await this.evaluateExpr(stmt.condition, env)) {
          const loopEnv = new Environment(env);
          try {
            await this.evaluateStmt(stmt.body, loopEnv);
          } catch (e) {
            if (e instanceof BreakException) break;
            if (e instanceof ContinueException) continue;
            throw e;
          }
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
          if (indexValue < 0 || indexValue >= arrayInstance.length) {
            throw new Error(`RuntimeError: index out of range [${indexValue}] with length ${arrayInstance.length}`);
          }
          arrayInstance[indexValue] = assignValue;
          return assignValue;
        } else {
          throw new Error(`SyntaxError: Invalid assignment target`);
        }

      case "MapLiteral":
        const mapObj = new Map<string, any>();
        for (const prop of expr.properties) {
          mapObj.set(prop.key, await this.evaluateExpr(prop.value, env));
        }
        return mapObj;

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

          // Construtores estáticos de HashMap (RFC-023)
          if (expr.caller.object.kind === "Identifier" && expr.caller.object.symbol === "HashMap") {
            if (expr.caller.property === "new") {
              return new Map();
            }
            if (expr.caller.property === "from") {
              const arg = await this.evaluateExpr(expr.args[0], env);
              if (arg instanceof Map) {
                return new Map(arg);
              }
              if (arg && typeof arg === "object") {
                return new Map(Object.entries(arg));
              }
              return new Map();
            }
          }

          const objectInstanceCall = await this.evaluateExpr(expr.caller.object, env);

          // Suporte a métodos de HashMap (RFC-023)
          if (objectInstanceCall instanceof Map) {
            const evaluatedArgs = [];
            for (const arg of expr.args) {
              evaluatedArgs.push(await this.evaluateExpr(arg, env));
            }
            switch (expr.caller.property) {
              case "len":
                return objectInstanceCall.size;
              case "is_empty":
                return objectInstanceCall.size === 0;
              case "get": {
                const key = evaluatedArgs[0];
                if (objectInstanceCall.has(key)) {
                  return optionSome(objectInstanceCall.get(key));
                }
                return optionNone();
              }
              case "set": {
                objectInstanceCall.set(evaluatedArgs[0], evaluatedArgs[1]);
                return undefined;
              }
              case "remove": {
                const key = evaluatedArgs[0];
                if (objectInstanceCall.has(key)) {
                  const val = objectInstanceCall.get(key);
                  objectInstanceCall.delete(key);
                  return optionSome(val);
                }
                return optionNone();
              }
              case "contains_key":
                return objectInstanceCall.has(evaluatedArgs[0]);
              case "keys":
                return Array.from(objectInstanceCall.keys());
              case "values":
                return Array.from(objectInstanceCall.values());
            }
          }

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
          
          // Suporte a métodos de conversão em números primitivos (Float/Int)
          if (typeof objectInstanceCall === "number") {
              if (expr.caller.property === "to_string") {
                  return String(objectInstanceCall);
              }
              if (expr.caller.property === "to_float") {
                  return objectInstanceCall;
              }
              if (expr.caller.property === "to_int") {
                  return Math.trunc(objectInstanceCall);
              }
              throw new Error(`TypeError: Method '${expr.caller.property}' not found on number`);
          }

          // Suporte a métodos em boolean primitivo (Bool)
          if (typeof objectInstanceCall === "boolean") {
              if (expr.caller.property === "to_string") {
                  return String(objectInstanceCall);
              }
              throw new Error(`TypeError: Method '${expr.caller.property}' not found on boolean`);
          }

          // Suporte a métodos de String (RFC-019)
          if (typeof objectInstanceCall === "string") {
            const evaluatedArgs = [];
            for (const arg of expr.args) {
              evaluatedArgs.push(await this.evaluateExpr(arg, env));
            }
            switch (expr.caller.property) {
              case "len":
                return Array.from(objectInstanceCall).length;
              case "contains":
                return objectInstanceCall.includes(evaluatedArgs[0]);
              case "starts_with":
                return objectInstanceCall.startsWith(evaluatedArgs[0]);
              case "ends_with":
                return objectInstanceCall.endsWith(evaluatedArgs[0]);
              case "to_upper":
                return objectInstanceCall.toUpperCase();
              case "to_lower":
                return objectInstanceCall.toLowerCase();
              case "trim":
                return objectInstanceCall.trim();
              case "split":
                return objectInstanceCall.split(evaluatedArgs[0]);
              case "replace":
                return objectInstanceCall.replaceAll(evaluatedArgs[0], evaluatedArgs[1]);
              case "substring": {
                const chars = Array.from(objectInstanceCall);
                const start = Math.max(0, Math.min(chars.length, evaluatedArgs[0]));
                const end = Math.max(start, Math.min(chars.length, evaluatedArgs[1]));
                return chars.slice(start, end).join("");
              }
              case "index_of": {
                const sub = evaluatedArgs[0];
                const rawIdx = objectInstanceCall.indexOf(sub);
                if (rawIdx === -1) {
                  return optionNone();
                }
                const charIdx = Array.from(objectInstanceCall.slice(0, rawIdx)).length;
                return optionSome(charIdx);
              }
              default:
                throw new Error(`TypeError: Method '${expr.caller.property}' not found on string`);
            }
          }

          // Suporte a métodos de Array (RFC-020)
          if (Array.isArray(objectInstanceCall)) {
            const prop = expr.caller.property;
            switch (prop) {
              case "len":
                return objectInstanceCall.length;
              case "is_empty":
                return objectInstanceCall.length === 0;
              case "contains": {
                const item = await this.evaluateExpr(expr.args[0], env);
                return objectInstanceCall.includes(item);
              }
              case "slice": {
                const start = await this.evaluateExpr(expr.args[0], env);
                const end = await this.evaluateExpr(expr.args[1], env);
                return objectInstanceCall.slice(start, end);
              }
              case "concat": {
                const other = await this.evaluateExpr(expr.args[0], env);
                return objectInstanceCall.concat(other);
              }
              case "push": {
                const item = await this.evaluateExpr(expr.args[0], env);
                objectInstanceCall.push(item);
                return undefined;
              }
              case "pop": {
                if (objectInstanceCall.length === 0) {
                  return optionNone();
                }
                const popped = objectInstanceCall.pop();
                return optionSome(popped);
              }
              case "sort": {
                objectInstanceCall.sort((a, b) => {
                  if (typeof a === "number" && typeof b === "number") return a - b;
                  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
                  return 0;
                });
                return undefined;
              }
              case "map": {
                const fn = await this.evaluateExpr(expr.args[0], env);
                const result = [];
                for (const item of objectInstanceCall) {
                  result.push(await this.callFunction(fn, [item]));
                }
                return result;
              }
              case "filter": {
                const fn = await this.evaluateExpr(expr.args[0], env);
                const result = [];
                for (const item of objectInstanceCall) {
                  const keep = await this.callFunction(fn, [item]);
                  if (keep) result.push(item);
                }
                return result;
              }
              case "find": {
                const fn = await this.evaluateExpr(expr.args[0], env);
                for (const item of objectInstanceCall) {
                  const match = await this.callFunction(fn, [item]);
                  if (match) return optionSome(item);
                }
                return optionNone();
              }
              case "for_each": {
                const fn = await this.evaluateExpr(expr.args[0], env);
                for (const item of objectInstanceCall) {
                  await this.callFunction(fn, [item]);
                }
                return undefined;
              }
              default:
                throw new Error(`TypeError: Method '${prop}' not found on Array`);
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

        if (expr.caller.kind === "Identifier") {
          if (expr.caller.symbol === "parse_int") {
            const raw = await this.evaluateExpr(expr.args[0], env);
            const str = String(raw).trim();
            if (!/^-?\d+$/.test(str)) {
              return resultErr(`invalid integer: ${str}`);
            }
            const num = parseInt(str, 10);
            if (isNaN(num)) {
              return resultErr(`invalid integer: ${str}`);
            }
            return resultOk(num);
          }
          if (expr.caller.symbol === "parse_float") {
            const raw = await this.evaluateExpr(expr.args[0], env);
            const str = String(raw).trim();
            if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(str)) {
              return resultErr(`invalid float: ${str}`);
            }
            const num = parseFloat(str);
            if (isNaN(num)) {
              return resultErr(`invalid float: ${str}`);
            }
            return resultOk(num);
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
                parts.push(this.formatOutput(await this.evaluateExpr(p, env)));
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
          if (idx < 0 || idx >= obj.length) {
            throw new Error(`RuntimeError: index out of range [${idx}] with length ${obj.length}`);
          }
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
          case "/": {
            const exprType = this.types.get(expr);
            const isIntDivision = exprType ? exprType.kind === "Int" : (Number.isInteger(left) && Number.isInteger(right));
            if (isIntDivision) {
              if (right === 0) {
                throw new Error("RuntimeError: division by zero");
              }
              return Math.trunc(left / right);
            }
            return left / right;
          }
          case "%":
            if (right === 0) {
              throw new Error("RuntimeError: division by zero");
            }
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
      case "LambdaExpr": {
        // Lambda vira uma FlexFunction com uma FunctionDeclaration sintética.
        // O closure captura o ambiente atual, exatamente como funções nomeadas.
        const syntheticDecl: FunctionDeclaration = {
          kind: "FunctionDeclaration",
          name: "__lambda",
          parameters: expr.parameters,
          returnType: undefined,
          body: expr.body,
        };
        return new FlexFunction(syntheticDecl, env);
      }
      case "RangeExpr": {
        const rStart = await this.evaluateExpr(expr.start, env);
        const rEnd = await this.evaluateExpr(expr.end, env);
        const arr: number[] = [];
        for (let i = rStart; i < rEnd; i++) arr.push(i);
        return arr;
      }
      default:
        throw new Error(`Expression not implemented in the interpreter`);
    }
  }

  private formatOutput(val: any): string {
    if (val === Infinity) return "+Inf";
    if (val === -Infinity) return "-Inf";
    if (typeof val === "number" && isNaN(val)) return "NaN";
    if (Object.is(val, -0)) return "0";
    return String(val);
  }
}
