import type { Stmt, Expr } from "./ast";

export class Interpreter {
  // Ambiente para armazenar variáveis na memória
  private environment = new Map<string, any>();

  public run(program: Stmt[]) {
    for (const stmt of program) {
      this.evaluateStmt(stmt);
    }
  }

  private evaluateStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "VarDeclaration":
        const value = this.evaluateExpr(stmt.value);
        this.environment.set(stmt.name, value);
        break;
      case "PrintStmt":
        console.log(this.evaluateExpr(stmt.value));
        break;
      default:
        // O TS garante que tratamos todos os "kinds" de Stmt aqui
        throw new Error(`Statement not implemented in the interpreter`);
    }
  }

  private evaluateExpr(expr: Expr): any {
    switch (expr.kind) {
      case "NumericLiteral":
        return expr.value;
      case "Identifier":
        if (!this.environment.has(expr.symbol)) {
          throw new Error(
            `ReferenceError: Identifier '${expr.symbol}' is not defined`,
          );
        }
        return this.environment.get(expr.symbol);
      case "BinaryExpr":
        const left = this.evaluateExpr(expr.left);
        const right = this.evaluateExpr(expr.right);
        if (expr.operator === "+") {
          return left + right;
        }
        throw new Error(`Unknown binary operator: ${expr.operator}`);
      default:
        throw new Error(`Expression not implemented in the interpreter`);
    }
  }
}
