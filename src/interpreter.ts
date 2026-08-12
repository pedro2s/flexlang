import type { Stmt, Expr } from "./ast";

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
			throw new Error(
				`ReferenceError: Identifier '${name}' is not defined`,
			);
		}
	}
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
				if (expr.operator === "+") {
					return left + right;
				}
				if (expr.operator === ">") {
					return left > right;
				}
				if (expr.operator === "<") {
					return left < right;
				}
				if (expr.operator === "==") {
					return left === right;
				}
				throw new Error(`Unknown binary operator: ${expr.operator}`);
			default:
				throw new Error(
					`Expression not implemented in the interpreter`,
				);
		}
	}
}
