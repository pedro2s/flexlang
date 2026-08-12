import type { Stmt, Expr, TypeNode } from "./ast";

export class GoTranspiler {
  private out: string = "";
  private indentLevel: number = 0;

  constructor() {}

  public transpile(program: Stmt[]): string {
    const declarations: Stmt[] = [];
    const mainStatements: Stmt[] = [];

    // Separa declaracoes de escopo global (structs, funcs) do corpo do programa
    for (const stmt of program) {
      if (
        stmt.kind === "StructDeclaration" ||
        stmt.kind === "FunctionDeclaration" ||
        stmt.kind === "EnumDeclaration" ||
        stmt.kind === "TraitDeclaration" ||
        stmt.kind === "ImplDeclaration"
      ) {
        declarations.push(stmt);
      } else {
        mainStatements.push(stmt);
      }
    }

    this.emitLine("package main");
    this.emitLine("");
    this.emitLine('import "fmt"');
    this.emitLine('import "sync"'); // Para o motor de scope/spawn
    this.emitLine("");

    for (const decl of declarations) {
      this.transpileStmt(decl);
      this.emitLine("");
    }

    this.emitLine("func main() {");
    this.indent();
    for (const stmt of mainStatements) {
      this.transpileStmt(stmt);
    }
    this.dedent();
    this.emitLine("}");

    return this.out;
  }

  private emit(code: string) {
    this.out += code;
  }

  private emitLine(code: string) {
    if (code.trim() === "") {
        this.out += "\n";
        return;
    }
    this.out += "  ".repeat(this.indentLevel) + code + "\n";
  }

  private indent() {
    this.indentLevel++;
  }

  private dedent() {
    this.indentLevel--;
  }

  private transpileStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "PrintStmt":
        this.emitLine(`fmt.Println(${this.transpileExpr(stmt.value)})`);
        break;

      case "VarDeclaration":
        // Como o TypeChecker já validou a mutabilidade, no Go será apenas uma variável comum
        // Usamos a inferência nativa do Go :=
        this.emitLine(`${stmt.name} := ${this.transpileExpr(stmt.value)}`);
        break;

      case "ExpressionStatement":
        this.emitLine(this.transpileExpr(stmt.expression));
        break;

      case "StructDeclaration":
        this.emitLine(`type ${stmt.name} struct {`);
        this.indent();
        for (const prop of stmt.properties) {
          this.emitLine(`${prop.name} ${this.transpileType(prop.typeAnnotation)}`);
        }
        this.dedent();
        this.emitLine(`}`);
        break;

      case "FunctionDeclaration":
        const params = stmt.parameters
          .map((p) => `${p.name} ${this.transpileType(p.typeAnnotation)}`)
          .join(", ");
        const retType = stmt.returnType ? this.transpileType(stmt.returnType) : "";
        this.emitLine(`func ${stmt.name}(${params}) ${retType} {`);
        this.indent();
        this.transpileBlock(stmt.body);
        this.dedent();
        this.emitLine(`}`);
        break;

      case "ImplDeclaration":
        // Em Go, métodos são anexados ao ponteiro da struct: func (self *Struct) Method()
        for (const method of stmt.methods) {
          const mParams = method.parameters
            .map((p) => `${p.name} ${this.transpileType(p.typeAnnotation)}`)
            .join(", ");
          const mRet = method.returnType ? this.transpileType(method.returnType) : "";
          this.emitLine(`func (self *${stmt.structName}) ${method.name}(${mParams}) ${mRet} {`);
          this.indent();
          this.transpileBlock(method.body);
          this.dedent();
          this.emitLine(`}`);
        }
        break;

      case "TraitDeclaration":
        this.emitLine(`type ${stmt.name} interface {`);
        this.indent();
        for (const method of stmt.methods) {
          const tParams = method.parameters
            .map((p) => `${p.name} ${this.transpileType(p.typeAnnotation)}`)
            .join(", ");
          const tRet = method.returnType ? this.transpileType(method.returnType) : "";
          this.emitLine(`${method.name}(${tParams}) ${tRet}`);
        }
        this.dedent();
        this.emitLine(`}`);
        break;

      case "BlockStmt":
        this.transpileBlock(stmt);
        break;

      case "IfStmt":
        this.emitLine(`if ${this.transpileExpr(stmt.condition)} {`);
        this.indent();
        this.transpileBlock(stmt.consequent);
        this.dedent();
        if (stmt.alternate) {
          this.emitLine(`} else {`);
          this.indent();
          this.transpileBlock(stmt.alternate);
          this.dedent();
        }
        this.emitLine(`}`);
        break;

      case "ForStmt":
        this.emitLine(`for ${stmt.iteratorName} := ${this.transpileExpr(stmt.start)}; ${stmt.iteratorName} < ${this.transpileExpr(stmt.end)}; ${stmt.iteratorName}++ {`);
        this.indent();
        this.transpileBlock(stmt.body);
        this.dedent();
        this.emitLine(`}`);
        break;

      case "ScopeStmt":
        // Concorrência estruturada via sync.WaitGroup
        this.emitLine(`{`); // Escopo limpo em Go
        this.indent();
        this.emitLine(`var wg sync.WaitGroup`);
        // Aqui dentro, os spawn vão injetar código
        // Precisaremos repassar a WaitGroup para dentro do bloco, mas
        // como `transpileStmt` não toma estado extra, vamos apenas injetar 'wg' em scope
        // e os 'spawn' dentro vão procurar a WaitGroup pai lexicalmente.
        this.transpileBlock(stmt.body);
        this.emitLine(`wg.Wait()`);
        this.dedent();
        this.emitLine(`}`);
        break;

      case "SpawnStmt":
        this.emitLine(`wg.Add(1)`);
        this.emitLine(`go func() {`);
        this.indent();
        this.emitLine(`defer wg.Done()`);
        this.transpileBlock(stmt.body);
        this.dedent();
        this.emitLine(`}()`);
        break;

      case "ReturnStmt":
        if (stmt.value) {
           this.emitLine(`return ${this.transpileExpr(stmt.value)}`);
        } else {
           this.emitLine(`return`);
        }
        break;

      case "WhileStmt":
        this.emitLine(`for ${this.transpileExpr(stmt.condition)} {`);
        this.indent();
        this.transpileBlock(stmt.body);
        this.dedent();
        this.emitLine(`}`);
        break;

      default:
        this.emitLine(`// TODO: transpile ${stmt.kind}`);
        break;
    }
  }

  private transpileBlock(block: any): void {
    if (!block.body) return;
    for (const stmt of block.body) {
      this.transpileStmt(stmt);
    }
  }

  private transpileExpr(expr: Expr): string {
    switch (expr.kind) {
      case "NumericLiteral":
      case "BooleanLiteral":
        return String(expr.value);
      case "StringLiteral":
        return `"${expr.value}"`;
      case "Identifier":
        return expr.symbol;
      case "BinaryExpr":
        return `${this.transpileExpr(expr.left)} ${expr.operator} ${this.transpileExpr(expr.right)}`;
      case "AssignmentExpr":
        return `${this.transpileExpr(expr.assignee)} = ${this.transpileExpr(expr.value)}`;
      case "MemberExpr":
        return `${this.transpileExpr(expr.object)}.${expr.property}`;
      case "CallExpr":
        if (expr.caller.kind === "MemberExpr") {
            const member = expr.caller;
            if (member.object.kind === "Identifier" && member.object.symbol === "Channel" && member.property === "new") {
                  return `make(chan any)`; // Pode ser refinado usando Types depois
            }
            
            // Translate Channel method calls to Go operators
            if (member.property === "send") {
                return `${this.transpileExpr(member.object)} <- ${this.transpileExpr(expr.args[0])}`;
            } else if (member.property === "recv") {
                return `<-${this.transpileExpr(member.object)}`;
            }
        }
        
        const args = expr.args.map((a) => this.transpileExpr(a)).join(", ");
        return `${this.transpileExpr(expr.caller)}(${args})`;
      case "StructExpr":
        const props = expr.properties
          .map((p) => `${p.name}: ${this.transpileExpr(p.value)}`)
          .join(", ");
        return `&${expr.structName}{${props}}`;
      case "StringInterpolationExpr":
        return expr.parts
           .map(p => typeof p === "string" ? `"${p}"` : `fmt.Sprint(${this.transpileExpr(p)})`)
           .join(" + ");
      default:
        return `/* expr ${expr.kind} */`;
    }
  }

  private transpileType(typeNode: TypeNode): string {
    if (typeNode.kind === "NamedTypeNode") {
      switch (typeNode.name) {
        case "Int":
          return "int";
        case "String":
          return "string";
        case "Bool":
          return "bool";
        case "Any":
          return "any";
        default:
          return typeNode.name; // Assumimos que e uma struct ou trait existente
      }
    }
    if (typeNode.kind === "ArrayTypeNode") {
      return `[]${this.transpileType(typeNode.elementType)}`;
    }
    if (typeNode.kind === "GenericTypeNode") {
       if (typeNode.name === "Channel") {
            return `chan ${this.transpileType(typeNode.typeArguments[0])}`;
       }
       return `any /* generic ${typeNode.name} */`;
    }
    return "any";
  }
}
