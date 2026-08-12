import {
  TokenType,
  type Token,
  type Stmt,
  type Expr,
  type VarDeclaration,
  type PrintStmt,
  type BlockStmt,
  type StringLiteral,
  type Parameter,
  type FunctionDeclaration,
  type ReturnStmt,
  type StructDeclaration,
  type ImplDeclaration,
} from "./ast";

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private current(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error("Unexpected end of tokens");
    return token;
  }

  private peek(offset = 1): Token | undefined {
    return this.tokens[this.pos + offset];
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
      statements.push(this.parseStatement());
    }
    return statements;
  }

  private parseStatement(): Stmt {
    if (this.current().type === TokenType.Impl) {
      return this.parseImplDeclaration();
    } else if (this.current().type === TokenType.Struct) {
      return this.parseStructDeclaration();
    } else if (this.current().type === TokenType.Let) {
      return this.parseVarDeclaration();
    } else if (this.current().type === TokenType.Print) {
      return this.parsePrintStatement();
    } else if (this.current().type === TokenType.If) {
      return this.parseIfStatement();
    } else if (this.current().type === TokenType.For) {
      return this.parseForStatement();
    } else if (this.current().type === TokenType.Func) {
      return this.parseFunctionDeclaration();
    } else if (this.current().type === TokenType.Return) {
      return this.parseReturnStatement();
    } else {
      // Fallback: Se não é palavra-chave de controle, deve ser uma expressão
      const expression = this.parseExpression();
      this.consume(TokenType.Semi);
      return { kind: "ExpressionStatement", expression };
    }
  }

  private parseImplDeclaration(): ImplDeclaration {
    this.consume(TokenType.Impl);
    const structName = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LBrace);
    const methods: FunctionDeclaration[] = [];

    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      methods.push(this.parseFunctionDeclaration());
    }
    this.consume(TokenType.RBrace);

    return { kind: "ImplDeclaration", structName, methods };
  }

  private parseCallMemberExpr(): Expr {
    let expr = this.parsePrimary(); // Pega a variável base (ex: 'p')

    while (true) {
      if (this.current().type === TokenType.Dot) {
        this.consume(TokenType.Dot);
        const propertyName = this.consume(TokenType.Identifier).value;
        expr = { kind: "MemberExpr", object: expr, property: propertyName };
      } else if (this.current().type === TokenType.LParen) {
        // É uma chamada de função/método (ex: (...))
        this.consume(TokenType.LParen);
        const args = this.parseArguments();
        this.consume(TokenType.RParen);
        expr = { kind: "CallExpr", caller: expr, args };
      } else {
        break;
      }
    }
    return expr;
  }

  private parseArguments(): Expr[] {
    const args: Expr[] = [];
    if (this.current().type !== TokenType.RParen) {
      do {
        args.push(this.parseExpression());
      } while (
        this.current().type === TokenType.Comma &&
        this.consume(TokenType.Comma)
      );
    }
    return args;
  }

  private parseStructDeclaration(): StructDeclaration {
    this.consume(TokenType.Struct);
    const name = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LBrace);
    const properties: { name: string; typeAnnotation: string }[] = [];
    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      const propertyName = this.consume(TokenType.Identifier).value;
      this.consume(TokenType.Colon);
      const typeAnnotation = this.consume(TokenType.Identifier).value;

      properties.push({ name: propertyName, typeAnnotation });

      // Consumir a vírgula (que pode ser opcional no último item, como no Rust)
      if (this.current().type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      }
    }

    this.consume(TokenType.RBrace);
    return { kind: "StructDeclaration", name, properties };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    this.consume(TokenType.Func);
    const name = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LParen);
    const parameters: Parameter[] = [];

    // Analisa os parâmetros: (a: Int, b: Int)
    while (
      this.current().type !== TokenType.RParen &&
      this.current().type != TokenType.EOF
    ) {
      const paramName = this.consume(TokenType.Identifier).value;
      this.consume(TokenType.Colon);
      const typeAnnotation = this.consume(TokenType.Identifier).value;
      parameters.push({ name: paramName, typeAnnotation });

      if (this.current().type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      }
    }
    this.consume(TokenType.RParen);

    let returnType: string | undefined = undefined;
    if (this.current().type === TokenType.Arrow) {
      this.consume(TokenType.Arrow);
      returnType = this.consume(TokenType.Identifier).value;
    }

    const body = this.parseBlock();

    return { kind: "FunctionDeclaration", name, parameters, returnType, body };
  }

  private parseReturnStatement(): ReturnStmt {
    this.consume(TokenType.Return);

    // Se for só "return;", o valor é undefined. Se tiver algo depois, parseia como expressão
    let value: Expr | undefined = undefined;
    if (this.current().type !== TokenType.Semi) {
      value = this.parseExpression();
    }

    this.consume(TokenType.Semi);
    return { kind: "ReturnStmt", value };
  }

  private parseBlock(): BlockStmt {
    this.consume(TokenType.LBrace);
    const body: Stmt[] = [];
    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      body.push(this.parseStatement());
    }
    this.consume(TokenType.RBrace);
    return { kind: "BlockStmt", body };
  }

  private parseIfStatement(): Stmt {
    this.consume(TokenType.If);
    const condition = this.parseExpression();
    const consequent = this.parseBlock();

    let alternate: BlockStmt | undefined = undefined;
    if (this.current().type === TokenType.Else) {
      this.consume(TokenType.Else);
      alternate = this.parseBlock();
    }

    return { kind: "IfStmt", condition, consequent, alternate };
  }

  private parseForStatement(): Stmt {
    this.consume(TokenType.For);
    const iteratorName = this.consume(TokenType.Identifier).value;
    this.consume(TokenType.In);

    const start = this.parseExpression(); // Ex: 0
    this.consume(TokenType.DotDot);
    const end = this.parseExpression(); // Ex: 10

    const body = this.parseBlock();

    return { kind: "ForStmt", iteratorName, start, end, body };
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
    return this.parseAssignmentExpr();
  }

  private parseAssignmentExpr(): Expr {
    const left = this.parseBinaryExpr();
    
    if (this.current().type === TokenType.Assign) {
      this.consume(TokenType.Assign);
      const value = this.parseAssignmentExpr();
      return { kind: "AssignmentExpr", assignee: left, value };
    }
    
    return left;
  }

  private parseBinaryExpr(): Expr {
    const left = this.parseMemberExpr();

    if (this.current().type === TokenType.Plus) {
      const operator = this.consume(TokenType.Plus).value;
      const right = this.parseMemberExpr();
      return { kind: "BinaryExpr", left, operator, right };
    } else if (this.current().type === TokenType.EqEq) {
      const operator = this.consume(TokenType.EqEq).value;
      const right = this.parseMemberExpr();
      return { kind: "BinaryExpr", left, operator, right };
    } else if (this.current().type === TokenType.Gt) {
      const operator = this.consume(TokenType.Gt).value;
      const right = this.parseMemberExpr();
      return { kind: "BinaryExpr", left, operator, right };
    } else if (this.current().type === TokenType.Lt) {
      const operator = this.consume(TokenType.Lt).value;
      const right = this.parseMemberExpr();
      return { kind: "BinaryExpr", left, operator, right };
    }

    return left;
  }

  // ATENÇÂO: Acesso a propriedades (p.x) tem a precedência mais alta.
  // Precisamos criar um novo nível na nossa avaliação de expressões.
  private parseMemberExpr(): Expr {
    // Começa com o lado esquerdo (o objeto/variável)
    let object = this.parseCallMemberExpr();

    // Enquanto tiver ponto, continua acessando propriedades
    while (this.current().type === TokenType.Dot) {
      this.consume(TokenType.Dot);
      const propertyName = this.consume(TokenType.Identifier).value;
      object = { kind: "MemberExpr", object, property: propertyName };
    }

    return object;
  }

  private parsePrimary(): Expr {
    const token = this.current();

    if (token.type === TokenType.Number) {
      this.consume(TokenType.Number);
      return { kind: "NumericLiteral", value: parseFloat(token.value) };
    } else if (token.type === TokenType.String) {
      this.consume(TokenType.String);
      // Remove as aspas duplas ao redor da string
      const cleanValue = token.value.slice(1, -1);
      return { kind: "StringLiteral", value: cleanValue };
    } else if (token.type === TokenType.Identifier) {
      this.consume(TokenType.Identifier);

      //   Se logo após o nome vier um '(', é uma chamada de função!
      // if (this.current().type === TokenType.LParen) {
      //   this.consume(TokenType.LParen);
      //   const args: Expr[] = [];

      //   while (
      //     this.current().type !== TokenType.RParen &&
      //     this.current().type !== TokenType.EOF
      //   ) {
      //     args.push(this.parseExpression());
      //     if (this.current().type === TokenType.Comma) {
      //       this.consume(TokenType.Comma);
      //     }
      //   }
      //   this.consume(TokenType.RParen);
      //   return {
      //     kind: "CallExpr",
      //     caller: { kind: "Identifier", symbol: token.value },
      //     args,
      //   };
      // }

      // Se for Instanciação de Struct: Nome { prop: valor, ... }
      if (
        this.current().type === TokenType.LBrace &&
        this.peek(1)?.type === TokenType.Identifier &&
        this.peek(2)?.type === TokenType.Colon
      ) {
        this.consume(TokenType.LBrace);
        const properties: { name: string; value: Expr }[] = [];

        while (
          this.current().type !== TokenType.RBrace &&
          this.current().type !== TokenType.EOF
        ) {
          const propertyName = this.consume(TokenType.Identifier).value;
          this.consume(TokenType.Colon);
          const propertyValue = this.parseExpression();
          properties.push({ name: propertyName, value: propertyValue });

          if (this.current().type === TokenType.Comma) {
            this.consume(TokenType.Comma);
          }
        }

        this.consume(TokenType.RBrace);
        return { kind: "StructExpr", structName: token.value, properties };
      }

      return { kind: "Identifier", symbol: token.value };
    } else if (token.type === TokenType.Self) {
      this.consume(TokenType.Self);
      return { kind: "Identifier", symbol: "self" };
    } else {
      throw new Error(`SyntaxError: Invalid expression '${token.value}'`);
    }
  }
}
