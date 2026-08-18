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
  type TypeNode,
  type EnumDeclaration,
  type MatchArm,
  type EnumVariantDecl,
  type TryExpr,
  type ScopeStmt,
  type SpawnStmt,
  type TraitDeclaration,
  type ImportDeclaration,
  type LambdaExpr,
  type Span,
} from "./ast";
import { Lexer } from "./lexer";
import { FlexError } from "./diagnostics";

export class Parser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private filePath: string = "",
  ) {}

  private current(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new FlexError("E1001", "Unexpected end of tokens");
    return token;
  }

  private peek(offset = 1): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1] ?? this.current();
  }

  private spanFrom(startToken: Token, endToken?: Token): Span {
    const end = endToken ?? this.previous();
    const endLen = end.value === "EOF" ? 0 : end.value.length;
    return {
      file: this.filePath,
      line: startToken.line,
      column: startToken.column,
      endLine: end.line,
      endColumn: end.column + endLen,
    };
  }

  private combineSpans(start?: Span, end?: Span): Span | undefined {
    if (!start && !end) return undefined;
    if (!start) return end;
    if (!end) return start;
    return {
      file: start.file || end.file || this.filePath,
      line: start.line,
      column: start.column,
      endLine: end.endLine,
      endColumn: end.endColumn,
    };
  }

  private consume(expected: TokenType): Token {
    const token = this.current();
    if (token.type === expected) {
      this.pos++;
      return token;
    }
    throw new FlexError(
      "E1001",
      `SyntaxError: Expected token ${expected}, got ${token.type} ('${token.value}') at position ${this.pos}`,
      this.spanFrom(token, token),
    );
  }

  private match(type: TokenType): boolean {
    if (this.current().type === type) {
      this.consume(type);
      return true;
    }
    return false;
  }

  public parse(): Stmt[] {
    const statements: Stmt[] = [];

    while (this.current().type !== TokenType.EOF) {
      statements.push(this.parseStatement());
    }
    return statements;
  }

  private parseStatement(): Stmt {
    switch (this.current().type) {
      case TokenType.Impl:
        return this.parseImplDeclaration();
      case TokenType.Enum:
        return this.parseEnumDeclaration();
      case TokenType.Match:
        return this.parseMatchStmt();
      case TokenType.Scope:
        return this.parseScopeStmt();
      case TokenType.Spawn:
        return this.parseSpawnStmt();
      case TokenType.Trait:
        return this.parseTraitDeclaration();
      case TokenType.Import:
        return this.parseImportDeclaration();
      case TokenType.Struct:
        return this.parseStructDeclaration();
      case TokenType.Let:
        return this.parseVarDeclaration();
      case TokenType.Const:
        return this.parseConstDeclaration();
      case TokenType.Print:
        return this.parsePrintStatement();
      case TokenType.If:
        return this.parseIfStatement();
      case TokenType.For:
        return this.parseForStatement();
      case TokenType.While:
        return this.parseWhileStmt();
      case TokenType.Func:
        return this.parseFunctionDeclaration();
      case TokenType.Return:
        return this.parseReturnStatement();
      case TokenType.Break: {
        const startToken = this.consume(TokenType.Break);
        if (this.current().type === TokenType.Semi) {
          this.consume(TokenType.Semi);
        }
        return { kind: "BreakStmt", span: this.spanFrom(startToken, this.previous()) };
      }
      case TokenType.Continue: {
        const startToken = this.consume(TokenType.Continue);
        if (this.current().type === TokenType.Semi) {
          this.consume(TokenType.Semi);
        }
        return { kind: "ContinueStmt", span: this.spanFrom(startToken, this.previous()) };
      }
      default: {
        const expression = this.parseExpression();
        let semiToken: Token | undefined = undefined;
        if (this.current().type === TokenType.Semi) {
          semiToken = this.consume(TokenType.Semi);
        } else if (this.current().type === TokenType.RBrace) {
          // Permite que a última expressão de um bloco omita o ponto-e-vírgula
        } else {
          semiToken = this.consume(TokenType.Semi);
        }
        return {
          kind: "ExpressionStatement",
          expression,
          span: semiToken ? this.combineSpans(expression.span, this.spanFrom(semiToken, semiToken)) : expression.span,
        };
      }
    }
  }

  private parseTraitDeclaration(): TraitDeclaration {
    const startToken = this.consume(TokenType.Trait);
    const name = this.consume(TokenType.Identifier).value;
    this.consume(TokenType.LBrace);

    const methods = [];
    while (this.current().type !== TokenType.RBrace && this.current().type !== TokenType.EOF) {
      const funcToken = this.consume(TokenType.Func);
      const methodName = this.consume(TokenType.Identifier).value;
      this.consume(TokenType.LParen);
      const parameters: Parameter[] = [];
      if (this.current().type !== TokenType.RParen) {
        do {
          const isMut = this.match(TokenType.Mut);
          const pToken = this.consume(TokenType.Identifier);
          const paramName = pToken.value;
          this.consume(TokenType.Colon);
          const paramType = this.parseTypeAnnotation();
          parameters.push({
            name: paramName,
            typeAnnotation: paramType,
            isMut,
            span: this.combineSpans(this.spanFrom(pToken, pToken), paramType.span),
          });
        } while (this.match(TokenType.Comma));
      }
      this.consume(TokenType.RParen);

      let returnType = undefined;
      if (this.match(TokenType.Arrow)) {
        returnType = this.parseTypeAnnotation();
      }

      const semi = this.consume(TokenType.Semi);
      methods.push({
        name: methodName,
        parameters,
        returnType,
        span: this.spanFrom(funcToken, semi),
      });
    }
    const endToken = this.consume(TokenType.RBrace);
    return {
      kind: "TraitDeclaration",
      name,
      methods,
      span: this.spanFrom(startToken, endToken),
    };
  }

  private parseImportDeclaration(): ImportDeclaration {
    const startToken = this.consume(TokenType.Import);
    const imports: string[] = [];

    // Verificamos se estamos importando algo especifico: import { A, B } from "module";
    if (this.current().type === TokenType.LBrace) {
      this.consume(TokenType.LBrace);
      do {
        imports.push(this.consume(TokenType.Identifier).value);
      } while (this.match(TokenType.Comma));
      this.consume(TokenType.RBrace);
      this.consume(TokenType.From);
    }

    // Se não tiver LBrace, podemos assumir import "module" (sem destructuring por agora)
    const moduleName = this.consume(TokenType.String).value;
    const semiToken = this.consume(TokenType.Semi);

    return {
      kind: "ImportDeclaration",
      moduleName,
      imports,
      span: this.spanFrom(startToken, semiToken),
    };
  }

  private parseImplDeclaration(): ImplDeclaration {
    const startToken = this.consume(TokenType.Impl);
    let traitName: string | undefined = undefined;
    let structName = this.consume(TokenType.Identifier).value;

    if (this.current().type === TokenType.For) {
      this.consume(TokenType.For);
      traitName = structName;
      structName = this.consume(TokenType.Identifier).value;
    }

    this.consume(TokenType.LBrace);
    const methods: FunctionDeclaration[] = [];

    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      methods.push(this.parseFunctionDeclaration());
    }
    const endToken = this.consume(TokenType.RBrace);
    return {
      kind: "ImplDeclaration",
      structName,
      traitName,
      methods,
      span: this.spanFrom(startToken, endToken),
    };
  }

  private parseEnumDeclaration(): EnumDeclaration {
    const startToken = this.consume(TokenType.Enum);
    const name = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LBrace);
    const variants: EnumVariantDecl[] = [];

    while (this.current().type !== TokenType.RBrace && this.current().type !== TokenType.EOF) {
      const vToken = this.consume(TokenType.Identifier);
      const variantName = vToken.value;
      let payload: TypeNode[] | undefined = undefined;
      let endVToken = vToken;

      if (this.current().type === TokenType.LParen) {
        this.consume(TokenType.LParen);
        payload = [];
        while (this.current().type !== TokenType.RParen && this.current().type !== TokenType.EOF) {
          payload.push(this.parseTypeAnnotation());
          if (this.current().type === TokenType.Comma) {
            this.consume(TokenType.Comma);
          }
        }
        endVToken = this.consume(TokenType.RParen);
      }

      variants.push({
        name: variantName,
        payload,
        span: this.spanFrom(vToken, endVToken),
      });

      if (this.current().type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      }
    }

    const endToken = this.consume(TokenType.RBrace);
    return {
      kind: "EnumDeclaration",
      name,
      variants,
      span: this.spanFrom(startToken, endToken),
    };
  }

  private parseStructDeclaration(): StructDeclaration {
    const startToken = this.consume(TokenType.Struct);
    const name = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LBrace);
    const properties: { name: string; typeAnnotation: TypeNode; span?: Span }[] = [];
    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      const pToken = this.consume(TokenType.Identifier);
      const propertyName = pToken.value;
      this.consume(TokenType.Colon);
      const typeAnnotation = this.parseTypeAnnotation();

      properties.push({
        name: propertyName,
        typeAnnotation,
        span: this.combineSpans(this.spanFrom(pToken, pToken), typeAnnotation.span),
      });

      if (this.current().type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      }
    }

    const endToken = this.consume(TokenType.RBrace);
    return {
      kind: "StructDeclaration",
      name,
      properties,
      span: this.spanFrom(startToken, endToken),
    };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const startToken = this.consume(TokenType.Func);
    const name = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LParen);
    const parameters: Parameter[] = [];

    while (
      this.current().type !== TokenType.RParen &&
      this.current().type != TokenType.EOF
    ) {
      const isMut = this.match(TokenType.Mut);

      if (this.current().type === TokenType.Self) {
        const selfToken = this.consume(TokenType.Self);
        parameters.push({
          name: "self",
          typeAnnotation: { kind: "Any" },
          isMut,
          span: this.spanFrom(selfToken, selfToken),
        });
      } else {
        const pToken = this.consume(TokenType.Identifier);
        const paramName = pToken.value;
        this.consume(TokenType.Colon);
        const typeAnnotation = this.parseTypeAnnotation();
        parameters.push({
          name: paramName,
          typeAnnotation,
          isMut,
          span: this.combineSpans(this.spanFrom(pToken, pToken), typeAnnotation.span),
        });
      }

      if (this.current().type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      }
    }
    this.consume(TokenType.RParen);

    let returnType: TypeNode | undefined = undefined;
    if (this.current().type === TokenType.Arrow) {
      this.consume(TokenType.Arrow);
      returnType = this.parseTypeAnnotation();
    }

    const body = this.parseBlock();

    return {
      kind: "FunctionDeclaration",
      name,
      parameters,
      returnType,
      body,
      span: this.spanFrom(startToken, this.previous()),
    };
  }

  private parseReturnStatement(): ReturnStmt {
    const startToken = this.consume(TokenType.Return);

    let value: Expr | undefined = undefined;
    if (this.current().type !== TokenType.Semi) {
      value = this.parseExpression();
    }

    const semiToken = this.consume(TokenType.Semi);
    return {
      kind: "ReturnStmt",
      value,
      span: this.spanFrom(startToken, semiToken),
    };
  }

  private parseBlock(): BlockStmt {
    const startToken = this.consume(TokenType.LBrace);
    const body: Stmt[] = [];
    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      body.push(this.parseStatement());
    }
    const endToken = this.consume(TokenType.RBrace);
    return { kind: "BlockStmt", body, span: this.spanFrom(startToken, endToken) };
  }

  private parseIfStatement(): Stmt {
    const startToken = this.consume(TokenType.If);
    const condition = this.parseExpression();
    const consequent = this.parseBlock();

    let alternate: BlockStmt | IfStmt | undefined = undefined;
    if (this.current().type === TokenType.Else) {
      this.consume(TokenType.Else);
      if (this.current().type === TokenType.If) {
        alternate = this.parseIfStatement() as IfStmt;
      } else {
        alternate = this.parseBlock();
      }
    }

    return {
      kind: "IfStmt",
      condition,
      consequent,
      alternate,
      span: this.spanFrom(startToken, this.previous()),
    };
  }

  private parseForStatement(): Stmt {
    const startToken = this.consume(TokenType.For);
    const iteratorName = this.consume(TokenType.Identifier).value;
    let indexName: string | undefined = undefined;

    if (this.match(TokenType.Comma)) {
      indexName = this.consume(TokenType.Identifier).value;
    }

    this.consume(TokenType.In);

    const firstExpr = this.parseExpression();
    let iterable: Expr;

    if (this.current().type === TokenType.DotDot) {
      this.consume(TokenType.DotDot);
      const endExpr = this.parseExpression();
      iterable = {
        kind: "RangeExpr",
        start: firstExpr,
        end: endExpr,
        span: this.combineSpans(firstExpr.span, endExpr.span),
      };
    } else {
      iterable = firstExpr;
    }

    const body = this.parseBlock();

    return {
      kind: "ForStmt",
      iteratorName,
      indexName,
      iterable,
      body,
      span: this.spanFrom(startToken, this.previous()),
    };
  }

  private parseMatchStmt(): MatchStmt {
    const startToken = this.consume(TokenType.Match);
    const value = this.parseExpression();

    this.consume(TokenType.LBrace);
    const arms: MatchArm[] = [];

    while (this.current().type !== TokenType.RBrace && this.current().type !== TokenType.EOF) {
      const armStart = this.current();
      const enumName = this.consume(TokenType.Identifier).value;
      this.consume(TokenType.Dot);
      const variantName = this.consume(TokenType.Identifier).value;

      const binders: string[] = [];
      if (this.current().type === TokenType.LParen) {
        this.consume(TokenType.LParen);
        while (this.current().type !== TokenType.RParen && this.current().type !== TokenType.EOF) {
          binders.push(this.consume(TokenType.Identifier).value);
          if (this.current().type === TokenType.Comma) {
            this.consume(TokenType.Comma);
          }
        }
        this.consume(TokenType.RParen);
      }

      // RFC-016: => foi eliminado — braço entra direto no bloco.
      // Se alguém usar a sintaxe antiga, emitimos diagnóstico amigável.
      if (this.current().type === TokenType.FatArrow) {
        throw new FlexError(
          "E1002",
          "sintaxe '=>' foi removida dos braços de match na v0.2 — use diretamente o bloco",
          this.spanFrom(this.current(), this.current()),
          "remova o '=>' e mantenha apenas o bloco { ... }",
        );
      }
      const body = this.parseBlock();
      arms.push({
        enumName,
        variantName,
        binders,
        body,
        span: this.spanFrom(armStart, this.previous()),
      });

      if (this.current().type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      }
    }

    const endToken = this.consume(TokenType.RBrace);
    return {
      kind: "MatchStmt",
      value,
      arms,
      span: this.spanFrom(startToken, endToken),
    };
  }

  private parseScopeStmt(): ScopeStmt {
    const startToken = this.consume(TokenType.Scope);
    let deadline: Expr | undefined = undefined;

    // Suporta scope (expr) { ... }
    if (this.current().type === TokenType.LParen) {
      this.consume(TokenType.LParen);
      deadline = this.parseExpression();
      this.consume(TokenType.RParen);
    }

    const body = this.parseBlock();
    return {
      kind: "ScopeStmt",
      deadline,
      body,
      span: this.spanFrom(startToken, this.previous()),
    };
  }

  private parseSpawnStmt(): SpawnStmt {
    const startToken = this.consume(TokenType.Spawn);
    const body = this.parseBlock();
    return {
      kind: "SpawnStmt",
      body,
      span: this.spanFrom(startToken, this.previous()),
    };
  }

  private parseWhileStmt(): Stmt {
    const startToken = this.consume(TokenType.While);
    const condition = this.parseExpression();
    const body = this.parseBlock();
    return {
      kind: "WhileStmt",
      condition,
      body,
      span: this.spanFrom(startToken, this.previous()),
    };
  }

  private parseVarDeclaration(): VarDeclaration {
    const startToken = this.consume(TokenType.Let);
    let isMut = false;
    if (this.current().type === TokenType.Mut) {
      this.consume(TokenType.Mut);
      isMut = true;
    }
    const name = this.consume(TokenType.Identifier).value;

    let typeAnnotation: TypeNode | undefined = undefined;
    if (this.current().type === TokenType.Colon) {
      this.consume(TokenType.Colon);
      typeAnnotation = this.parseTypeAnnotation();
    }

    this.consume(TokenType.Assign);
    const value = this.parseExpression();
    const semiToken = this.consume(TokenType.Semi);

    return {
      kind: "VarDeclaration",
      name,
      typeAnnotation,
      value,
      isMut,
      span: this.spanFrom(startToken, semiToken),
    };
  }

  private parseConstDeclaration(): ConstDeclaration {
    const startToken = this.consume(TokenType.Const);
    const name = this.consume(TokenType.Identifier).value;

    let typeAnnotation: TypeNode | undefined = undefined;
    if (this.current().type === TokenType.Colon) {
      this.consume(TokenType.Colon);
      typeAnnotation = this.parseTypeAnnotation();
    }

    this.consume(TokenType.Assign);
    const value = this.parseExpression();
    const semiToken = this.consume(TokenType.Semi);

    return {
      kind: "ConstDeclaration",
      name,
      typeAnnotation,
      value,
      span: this.spanFrom(startToken, semiToken),
    };
  }

  // =========== PARSER DE TIPOS ===========
  private parseTypeAnnotation(): TypeNode {
    if (this.current().type === TokenType.LBracket) {
      const startToken = this.consume(TokenType.LBracket);
      const elementType = this.parseTypeAnnotation();
      const endToken = this.consume(TokenType.RBracket);
      return {
        kind: "ArrayTypeNode",
        elementType,
        span: this.spanFrom(startToken, endToken),
      };
    }

    const typeToken = this.consume(TokenType.Identifier);
    const typeName = typeToken.value;

    if (this.current().type === TokenType.Lt) {
      this.consume(TokenType.Lt);
      const typeArguments: TypeNode[] = [];
      while (this.current().type !== TokenType.Gt && this.current().type !== TokenType.EOF) {
        typeArguments.push(this.parseTypeAnnotation());
        if (this.current().type === TokenType.Comma) {
          this.consume(TokenType.Comma);
        }
      }
      const gtToken = this.consume(TokenType.Gt);
      return {
        kind: "GenericTypeNode",
        name: typeName,
        typeArguments,
        span: this.spanFrom(typeToken, gtToken),
      };
    }

    return {
      kind: "NamedTypeNode",
      name: typeName,
      span: this.spanFrom(typeToken, typeToken),
    };
  }

  private parsePrintStatement(): PrintStmt {
    const startToken = this.consume(TokenType.Print);
    this.consume(TokenType.LParen);
    const value = this.parseExpression();
    this.consume(TokenType.RParen);
    const semiToken = this.consume(TokenType.Semi);
    return {
      kind: "PrintStmt",
      value,
      span: this.spanFrom(startToken, semiToken),
    };
  }

  private parseExpression(): Expr {
    return this.parseAssignmentExpr();
  }

  private parseAssignmentExpr(): Expr {
    const left = this.parseCatchExpr();

    if (this.current().type === TokenType.Assign) {
      this.consume(TokenType.Assign);
      const value = this.parseAssignmentExpr();
      return {
        kind: "AssignmentExpr",
        assignee: left as any,
        value,
        span: this.combineSpans(left.span, value.span),
      };
    }

    return left;
  }

  private parseCatchExpr(): Expr {
    let expr = this.parseBinaryExpr();

    while (this.current().type === TokenType.Catch) {
      this.consume(TokenType.Catch);
      let errorBinder = "err";
      if (this.current().type === TokenType.Identifier) {
        errorBinder = this.consume(TokenType.Identifier).value;
      }
      const body = this.parseBlock();
      expr = {
        kind: "CatchExpr",
        expression: expr,
        errorBinder,
        body,
        span: this.combineSpans(expr.span, body.span),
      };
    }

    return expr;
  }

  private parseBinaryExpr(): Expr {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.current().type === TokenType.Or) {
      const operator = this.consume(TokenType.Or).value;
      const right = this.parseLogicalAnd();
      left = {
        kind: "LogicalExpr",
        left,
        operator,
        right,
        span: this.combineSpans(left.span, right.span),
      };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.current().type === TokenType.And) {
      const operator = this.consume(TokenType.And).value;
      const right = this.parseEquality();
      left = {
        kind: "LogicalExpr",
        left,
        operator,
        right,
        span: this.combineSpans(left.span, right.span),
      };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseRelational();
    while (
      this.current().type === TokenType.EqEq ||
      this.current().type === TokenType.NotEq
    ) {
      const operator = this.consume(this.current().type).value;
      const right = this.parseRelational();
      left = {
        kind: "BinaryExpr",
        left,
        operator,
        right,
        span: this.combineSpans(left.span, right.span),
      };
    }
    return left;
  }

  private parseRelational(): Expr {
    let left = this.parseAdditive();
    while (
      this.current().type === TokenType.Gt ||
      this.current().type === TokenType.Lt ||
      this.current().type === TokenType.GtEq ||
      this.current().type === TokenType.LtEq
    ) {
      const operator = this.consume(this.current().type).value;
      const right = this.parseAdditive();
      left = {
        kind: "BinaryExpr",
        left,
        operator,
        right,
        span: this.combineSpans(left.span, right.span),
      };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (
      this.current().type === TokenType.Plus ||
      this.current().type === TokenType.Minus
    ) {
      const operator = this.consume(this.current().type).value;
      const right = this.parseMultiplicative();
      left = {
        kind: "BinaryExpr",
        left,
        operator,
        right,
        span: this.combineSpans(left.span, right.span),
      };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (
      this.current().type === TokenType.Star ||
      this.current().type === TokenType.Slash ||
      this.current().type === TokenType.Modulo
    ) {
      const operator = this.consume(this.current().type).value;
      const right = this.parseUnary();
      left = {
        kind: "BinaryExpr",
        left,
        operator,
        right,
        span: this.combineSpans(left.span, right.span),
      };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.current().type === TokenType.Bang || this.current().type === TokenType.Minus) {
      const opToken = this.consume(this.current().type);
      const argument = this.parseUnary(); // recursivo para lidar com !!true ou --5
      const opSpan = this.spanFrom(opToken, opToken);
      return {
        kind: "UnaryExpr",
        operator: opToken.value,
        argument,
        span: this.combineSpans(opSpan, argument.span),
      };
    }
    return this.parseMemberExpr();
  }

  // ATENÇÂO: Acesso a propriedades (p.x) tem a precedência mais alta.
  private consumePropertyName(): Token {
    const curr = this.current();
    if (
      curr.type === TokenType.Identifier ||
      curr.type === TokenType.From ||
      curr.type === TokenType.Match ||
      curr.type === TokenType.For ||
      curr.type === TokenType.In ||
      curr.type === TokenType.Import ||
      curr.type === TokenType.Let ||
      curr.type === TokenType.Const ||
      curr.type === TokenType.Mut ||
      curr.type === TokenType.Return ||
      curr.type === TokenType.Struct ||
      curr.type === TokenType.Enum ||
      curr.type === TokenType.Trait ||
      curr.type === TokenType.Impl ||
      curr.type === TokenType.Self ||
      curr.type === TokenType.Print ||
      curr.type === TokenType.True ||
      curr.type === TokenType.False ||
      curr.type === TokenType.If ||
      curr.type === TokenType.Else ||
      curr.type === TokenType.While ||
      curr.type === TokenType.Break ||
      curr.type === TokenType.Continue ||
      curr.type === TokenType.Spawn ||
      curr.type === TokenType.Scope
    ) {
      this.pos++;
      return curr;
    }
    return this.consume(TokenType.Identifier);
  }

  private parseMemberExpr(): Expr {
    let object = this.parseCallMemberExpr();

    while (
      this.current().type === TokenType.Dot ||
      this.current().type === TokenType.LBracket ||
      this.current().type === TokenType.Question
    ) {
      if (this.current().type === TokenType.Question) {
        const qToken = this.consume(TokenType.Question);
        const qSpan = this.spanFrom(qToken, qToken);
        object = {
          kind: "TryExpr",
          expression: object,
          span: this.combineSpans(object.span, qSpan),
        };
      } else if (this.current().type === TokenType.Dot) {
        this.consume(TokenType.Dot);
        const propToken = this.consumePropertyName();
        const propSpan = this.spanFrom(propToken, propToken);
        object = {
          kind: "MemberExpr",
          object,
          property: propToken.value,
          span: this.combineSpans(object.span, propSpan),
        };
      } else if (this.current().type === TokenType.LBracket) {
        this.consume(TokenType.LBracket);
        const index = this.parseExpression();
        const rBracket = this.consume(TokenType.RBracket);
        const rbSpan = this.spanFrom(rBracket, rBracket);
        object = {
          kind: "IndexExpr",
          object,
          index,
          span: this.combineSpans(object.span, rbSpan),
        };
      }
    }

    return object;
  }

  private parseCallMemberExpr(): Expr {
    let expr = this.parsePrimary();

    while (true) {
      if (this.current().type === TokenType.Dot) {
        this.consume(TokenType.Dot);
        const propToken = this.consumePropertyName();
        const propSpan = this.spanFrom(propToken, propToken);
        expr = {
          kind: "MemberExpr",
          object: expr,
          property: propToken.value,
          span: this.combineSpans(expr.span, propSpan),
        };
      } else if (this.current().type === TokenType.LParen) {
        this.consume(TokenType.LParen);
        const args = this.parseArguments();
        const rParen = this.consume(TokenType.RParen);
        const rpSpan = this.spanFrom(rParen, rParen);
        expr = {
          kind: "CallExpr",
          caller: expr,
          args,
          span: this.combineSpans(expr.span, rpSpan),
        };
      } else if (this.current().type === TokenType.LBracket) {
        this.consume(TokenType.LBracket);
        const index = this.parseExpression();
        const rBracket = this.consume(TokenType.RBracket);
        const rbSpan = this.spanFrom(rBracket, rBracket);
        expr = {
          kind: "IndexExpr",
          object: expr,
          index,
          span: this.combineSpans(expr.span, rbSpan),
        };
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
        // Lambda inline como argumento: db.transaction(|tx| { ... })
        if (this.current().type === TokenType.Pipe || this.current().type === TokenType.Or) {
          args.push(this.parseLambdaExpr());
        } else {
          args.push(this.parseExpression());
        }
      } while (
        this.current().type === TokenType.Comma &&
        this.consume(TokenType.Comma)
      );
    }
    return args;
  }

  private parsePrimary(): Expr {
    const token = this.current();

    if (token.type === TokenType.Number) {
      this.consume(TokenType.Number);
      return {
        kind: "NumericLiteral",
        value: parseFloat(token.value),
        isFloat: token.value.includes("."),
        span: this.spanFrom(token, token),
      };
    } else if (token.type === TokenType.String) {
      this.consume(TokenType.String);
      const content = token.value.slice(1, -1);

      const parts: (string | Expr)[] = [];
      let currentStr = "";
      let i = 0;

      while (i < content.length) {
        if (content[i] === "$" && content[i + 1] === "{") {
          if (currentStr) parts.push(currentStr);
          currentStr = "";
          i += 2;

          let exprStr = "";
          let braceDepth = 1;
          while (i < content.length && braceDepth > 0) {
            if (content[i] === "{") braceDepth++;
            if (content[i] === "}") braceDepth--;
            if (braceDepth > 0) exprStr += content[i];
            i++;
          }

          // Lexer sub-chamada para interpolação
          const subLexer = new Lexer(exprStr);
          const subParser = new Parser(subLexer.tokenize(), this.filePath);
          parts.push(subParser.parseExpression());
        } else {
          currentStr += content[i];
          i++;
        }
      }

      if (currentStr) parts.push(currentStr);

      if (parts.every((p) => typeof p === "string")) {
        return { kind: "StringLiteral", value: content, span: this.spanFrom(token, token) };
      }

      return {
        kind: "StringInterpolationExpr",
        parts,
        span: this.spanFrom(token, token),
      };
    } else if (token.type === TokenType.True) {
      this.consume(TokenType.True);
      return { kind: "BooleanLiteral", value: true, span: this.spanFrom(token, token) };
    } else if (token.type === TokenType.False) {
      this.consume(TokenType.False);
      return { kind: "BooleanLiteral", value: false, span: this.spanFrom(token, token) };
    } else if (token.type === TokenType.LBracket) {
      const startBracket = this.consume(TokenType.LBracket);
      const elements: Expr[] = [];
      while (this.current().type !== TokenType.RBracket && this.current().type !== TokenType.EOF) {
        elements.push(this.parseExpression());
        if (this.current().type === TokenType.Comma) {
          this.consume(TokenType.Comma);
        }
      }
      const endBracket = this.consume(TokenType.RBracket);
      return {
        kind: "ArrayLiteral",
        elements,
        span: this.spanFrom(startBracket, endBracket),
      };
    } else if (token.type === TokenType.LBrace) {
      const startBrace = this.consume(TokenType.LBrace);
      const properties: { key: string; value: Expr; span?: Span }[] = [];

      while (
        this.current().type !== TokenType.RBrace &&
        this.current().type !== TokenType.EOF
      ) {
        const keyToken = this.current();
        let key: string;
        if (this.current().type === TokenType.String) {
          key = this.consume(TokenType.String).value.slice(1, -1);
        } else if (this.current().type === TokenType.Identifier) {
          key = this.consume(TokenType.Identifier).value;
        } else {
          throw new FlexError(
            "E1001",
            `SyntaxError: Expected string or identifier as Map key, got ${this.current().value}`,
            this.spanFrom(this.current(), this.current()),
          );
        }

        this.consume(TokenType.Colon);
        const value = this.parseExpression();
        properties.push({
          key,
          value,
          span: this.combineSpans(this.spanFrom(keyToken, keyToken), value.span),
        });

        if (this.current().type === TokenType.Comma) {
          this.consume(TokenType.Comma);
        }
      }

      const endBrace = this.consume(TokenType.RBrace);
      return {
        kind: "MapLiteral",
        properties,
        span: this.spanFrom(startBrace, endBrace),
      };
    } else if (token.type === TokenType.Identifier) {
      this.consume(TokenType.Identifier);

      // Se for Instanciação de Struct: Nome { prop: valor, ... }
      if (
        this.current().type === TokenType.LBrace &&
        this.peek(1)?.type === TokenType.Identifier &&
        this.peek(2)?.type === TokenType.Colon
      ) {
        this.consume(TokenType.LBrace);
        const properties: { name: string; value: Expr; span?: Span }[] = [];

        while (
          this.current().type !== TokenType.RBrace &&
          this.current().type !== TokenType.EOF
        ) {
          const propToken = this.consume(TokenType.Identifier);
          const propertyName = propToken.value;
          this.consume(TokenType.Colon);
          const propertyValue = this.parseExpression();
          properties.push({
            name: propertyName,
            value: propertyValue,
            span: this.combineSpans(this.spanFrom(propToken, propToken), propertyValue.span),
          });

          if (this.current().type === TokenType.Comma) {
            this.consume(TokenType.Comma);
          }
        }

        const endBrace = this.consume(TokenType.RBrace);
        return {
          kind: "StructExpr",
          structName: token.value,
          properties,
          span: this.spanFrom(token, endBrace),
        };
      }

      return {
        kind: "Identifier",
        symbol: token.value,
        span: this.spanFrom(token, token),
      };
    } else if (token.type === TokenType.Self) {
      this.consume(TokenType.Self);
      return {
        kind: "Identifier",
        symbol: "self",
        span: this.spanFrom(token, token),
      };
    } else if (token.type === TokenType.LParen) {
      this.consume(TokenType.LParen);
      const expr = this.parseExpression();
      this.consume(TokenType.RParen);
      return expr;
    } else if (token.type === TokenType.Pipe || token.type === TokenType.Or) {
      return this.parseLambdaExpr();
    } else {
      throw new FlexError(
        "E1001",
        `SyntaxError: Invalid expression '${token.value}'`,
        this.spanFrom(token, token),
      );
    }
  }

  /**
   * Parseia uma lambda expression: |param1: Type1, param2: Type2| { body }
   * Os parâmetros têm tipagem obrigatória, igual a funções normais.
   */
  private parseLambdaExpr(): LambdaExpr {
    const startToken = this.current();
    const parameters: Parameter[] = [];

    // || (token Or) significa lambda sem parâmetros: || { body }
    if (this.current().type === TokenType.Or) {
      this.consume(TokenType.Or);
      // Sem parâmetros — o || já consumiu ambos os pipes
    } else {
      this.consume(TokenType.Pipe);
      if (this.current().type !== TokenType.Pipe) {
        do {
          const isMut = this.match(TokenType.Mut);
          const pToken = this.consume(TokenType.Identifier);
          const paramName = pToken.value;
          let typeAnnotation: TypeNode;
          if (this.match(TokenType.Colon)) {
            typeAnnotation = this.parseTypeAnnotation();
          } else {
            typeAnnotation = { kind: "NamedTypeNode", name: "Any", span: this.spanFrom(pToken, pToken) };
          }
          parameters.push({
            name: paramName,
            typeAnnotation,
            isMut,
            span: this.combineSpans(this.spanFrom(pToken, pToken), typeAnnotation.span),
          });
        } while (this.match(TokenType.Comma));
      }
      this.consume(TokenType.Pipe);
    }

    const body = this.parseBlock();
    return {
      kind: "LambdaExpr",
      parameters,
      body,
      span: this.combineSpans(this.spanFrom(startToken, startToken), body.span),
    };
  }
}
