import { TokenType, type Token, type Stmt, type Expr, type VarDeclaration, type PrintStmt } from "./ast";

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private current(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error("Unexpected end of tokens");
    return token;
  }

  private consume(expected: TokenType): Token {
    const token = this.current();
    if (token.type === expected) {
      this.pos++;
      return token;
    }
    throw new Error(
      `SyntaxError: Expected token ${expected}, got ${token.type} ('${token.value}') at position ${this.pos}`,
    );
  }

  public parse(): Stmt[] {
    const statements: Stmt[] = [];

    while (this.current().type !== TokenType.EOF) {
      if (this.current().type === TokenType.Let) {
        statements.push(this.parseVarDeclaration());
      } else if (this.current().type === TokenType.Print) {
        statements.push(this.parsePrintStatement());
      } else {
        throw new Error(
          `SyntaxError: Unknown statemtent '${this.current().value}'`,
        );
      }
    }
    return statements;
  }

  private parseVarDeclaration(): VarDeclaration {
    this.consume(TokenType.Let);
    const name = this.consume(TokenType.Identifier).value;

    let typeAnnotation: string | undefined = undefined;
    if (this.current().type === TokenType.Colon) {
      this.consume(TokenType.Colon);
      typeAnnotation = this.consume(TokenType.Identifier).value;
    }

    this.consume(TokenType.Assign);
    const value = this.parseExpression();
    this.consume(TokenType.Semi);

    return { kind: "VarDeclaration", name, typeAnnotation, value };
  }

  private parsePrintStatement(): PrintStmt {
    this.consume(TokenType.Print);
    this.consume(TokenType.LParen);
    const value = this.parseExpression();
    this.consume(TokenType.RParen);
    this.consume(TokenType.Semi);
    return { kind: "PrintStmt", value };
  }

  private parseExpression(): Expr {
    const left = this.parsePrimary();

    if (this.current().type === TokenType.Plus) {
      const operator = this.consume(TokenType.Plus).value;
      const right = this.parsePrimary();
      return { kind: "BinaryExpr", left, operator, right };
    }
    return left;
  }

  private parsePrimary(): Expr {
    const token = this.current();
    if (token.type === TokenType.Number) {
      this.consume(TokenType.Number);
      return { kind: "NumericLiteral", value: parseFloat(token.value) };
    } else if (token.type === TokenType.Identifier) {
      this.consume(TokenType.Identifier);
      return { kind: "Identifier", symbol: token.value };
    } else {
      throw new Error(`SyntaxError: Invalid expression '${token.value}'`);
    }
  }
}
