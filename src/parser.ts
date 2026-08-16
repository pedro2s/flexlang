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
} from "./ast";
import { Lexer } from "./lexer";

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
      default:
        const expression = this.parseExpression();
        this.consume(TokenType.Semi);
        return { kind: "ExpressionStatement", expression };
    }
  }

  private parseTraitDeclaration(): TraitDeclaration {
    this.consume(TokenType.Trait);
    const name = this.consume(TokenType.Identifier).value;
    this.consume(TokenType.LBrace);

    const methods = [];
    while (this.current().type !== TokenType.RBrace && this.current().type !== TokenType.EOF) {
        this.consume(TokenType.Func);
        const methodName = this.consume(TokenType.Identifier).value;
        this.consume(TokenType.LParen);
        const parameters = [];
        if (this.current().type !== TokenType.RParen) {
            do {
                const isMut = this.match(TokenType.Mut);
                const paramName = this.consume(TokenType.Identifier).value;
                this.consume(TokenType.Colon);
                const paramType = this.parseTypeAnnotation();
                parameters.push({ name: paramName, typeAnnotation: paramType, isMut });
            } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.RParen);
        
        let returnType = undefined;
        if (this.match(TokenType.Arrow)) {
            returnType = this.parseTypeAnnotation();
        }
        
        this.consume(TokenType.Semi);
        methods.push({ name: methodName, parameters, returnType });
    }
    this.consume(TokenType.RBrace);
    return { kind: "TraitDeclaration", name, methods };
  }

  private parseImportDeclaration(): ImportDeclaration {
    this.consume(TokenType.Import);
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
    this.consume(TokenType.Semi);
    
    return { kind: "ImportDeclaration", moduleName, imports };
  }

  private parseImplDeclaration(): ImplDeclaration {
    this.consume(TokenType.Impl);
    let traitName: string | undefined = undefined;
    let structName = this.consume(TokenType.Identifier).value;
    
    if (this.current().type === TokenType.For) {
         this.consume(TokenType.For);
         traitName = structName;
         structName = this.consume(TokenType.Identifier).value;
    }

    this.consume(TokenType.LBrace);
    const methods: FunctionDeclaration[] = [];

    while(
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      methods.push(this.parseFunctionDeclaration());
    }
    this.consume(TokenType.RBrace);
    return { kind: "ImplDeclaration", structName, traitName, methods };
  }

  private parseCallMemberExpr(): Expr {
    let expr = this.parsePrimary();

    while (true) {
      if (this.current().type === TokenType.Dot) {
        this.consume(TokenType.Dot);
        const propertyName = this.consume(TokenType.Identifier).value;
        expr = { kind: "MemberExpr", object: expr, property: propertyName };
      } else if (this.current().type === TokenType.LParen) {
        this.consume(TokenType.LParen);
        const args = this.parseArguments();
        this.consume(TokenType.RParen);
        expr = { kind: "CallExpr", caller: expr, args };
      } else if (this.current().type === TokenType.LBracket) {
        this.consume(TokenType.LBracket);
        const index = this.parseExpression();
        this.consume(TokenType.RBracket);
        expr = { kind: "IndexExpr", object: expr, index };
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

  private parseEnumDeclaration(): EnumDeclaration {
    this.consume(TokenType.Enum);
    const name = this.consume(TokenType.Identifier).value;
    
    this.consume(TokenType.LBrace);
    const variants: EnumVariantDecl[] = [];
    
    while (this.current().type !== TokenType.RBrace && this.current().type !== TokenType.EOF) {
        const variantName = this.consume(TokenType.Identifier).value;
        let payload: TypeNode[] | undefined = undefined;
        
        if (this.current().type === TokenType.LParen) {
            this.consume(TokenType.LParen);
            payload = [];
            while (this.current().type !== TokenType.RParen && this.current().type !== TokenType.EOF) {
                payload.push(this.parseTypeAnnotation());
                if (this.current().type === TokenType.Comma) {
                    this.consume(TokenType.Comma);
                }
            }
            this.consume(TokenType.RParen);
        }
        
        variants.push({ name: variantName, payload });
        
        if (this.current().type === TokenType.Comma) {
            this.consume(TokenType.Comma);
        }
    }
    
    this.consume(TokenType.RBrace);
    return { kind: "EnumDeclaration", name, variants };
  }

  private parseStructDeclaration(): StructDeclaration {
    this.consume(TokenType.Struct);
    const name = this.consume(TokenType.Identifier).value;

    this.consume(TokenType.LBrace);
    const properties: { name: string; typeAnnotation: TypeNode }[] = [];
    while (
      this.current().type !== TokenType.RBrace &&
      this.current().type !== TokenType.EOF
    ) {
      const propertyName = this.consume(TokenType.Identifier).value;
      this.consume(TokenType.Colon);
      const typeAnnotation = this.parseTypeAnnotation();

      properties.push({ name: propertyName, typeAnnotation });

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

    while (
      this.current().type !== TokenType.RParen &&
      this.current().type != TokenType.EOF
    ) {
      const isMut = this.match(TokenType.Mut);
      
      if (this.current().type === TokenType.Self) {
          this.consume(TokenType.Self);
          parameters.push({ name: "self", typeAnnotation: { kind: "Any" }, isMut });
      } else {
          const paramName = this.consume(TokenType.Identifier).value;
          this.consume(TokenType.Colon);
          const typeAnnotation = this.parseTypeAnnotation();
          parameters.push({ name: paramName, typeAnnotation, isMut });
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

    return { kind: "FunctionDeclaration", name, parameters, returnType, body };
  }

  private parseReturnStatement(): ReturnStmt {
    this.consume(TokenType.Return);

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

    const start = this.parseExpression();
    this.consume(TokenType.DotDot);
    const end = this.parseExpression();

    const body = this.parseBlock();

    return { kind: "ForStmt", iteratorName, start, end, body };
  }

  private parseMatchStmt(): MatchStmt {
    this.consume(TokenType.Match);
    const value = this.parseExpression();
    
    this.consume(TokenType.LBrace);
    const arms: MatchArm[] = [];
    
    while (this.current().type !== TokenType.RBrace && this.current().type !== TokenType.EOF) {
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
        
        this.consume(TokenType.FatArrow);
        const body = this.parseBlock();
        arms.push({ enumName, variantName, binders, body });
        
        if (this.current().type === TokenType.Comma) {
            this.consume(TokenType.Comma);
        }
    }
    
    this.consume(TokenType.RBrace);
    return { kind: "MatchStmt", value, arms };
  }

  private parseScopeStmt(): ScopeStmt {
    this.consume(TokenType.Scope);
    let deadline: Expr | undefined = undefined;
    
    // Suporta scope (expr) { ... }
    if (this.current().type === TokenType.LParen) {
        this.consume(TokenType.LParen);
        deadline = this.parseExpression();
        this.consume(TokenType.RParen);
    }
    
    const body = this.parseBlock();
    return { kind: "ScopeStmt", deadline, body };
  }

  private parseSpawnStmt(): SpawnStmt {
    this.consume(TokenType.Spawn);
    const body = this.parseBlock();
    return { kind: "SpawnStmt", body };
  }

  private parseWhileStmt(): Stmt {
    this.consume(TokenType.While);
    const condition = this.parseExpression();
    const body = this.parseBlock();
    return { kind: "WhileStmt", condition, body };
  }

  private parseVarDeclaration(): VarDeclaration {
    this.consume(TokenType.Let);
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
    this.consume(TokenType.Semi);

    return { kind: "VarDeclaration", name, typeAnnotation, value, isMut };
  }

  // =========== PARSER DE TIPOS ===========
  private parseTypeAnnotation(): TypeNode {
    if (this.current().type === TokenType.LBracket) {
      this.consume(TokenType.LBracket);
      const elementType = this.parseTypeAnnotation();
      this.consume(TokenType.RBracket);
      return { kind: "ArrayTypeNode", elementType };
    }

    const typeName = this.consume(TokenType.Identifier).value;

    if (this.current().type === TokenType.Lt) {
      this.consume(TokenType.Lt);
      const typeArguments: TypeNode[] = [];
      while (this.current().type !== TokenType.Gt && this.current().type !== TokenType.EOF) {
        typeArguments.push(this.parseTypeAnnotation());
        if (this.current().type === TokenType.Comma) {
          this.consume(TokenType.Comma);
        }
      }
      this.consume(TokenType.Gt);
      return { kind: "GenericTypeNode", name: typeName, typeArguments };
    }

    return { kind: "NamedTypeNode", name: typeName };
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
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.current().type === TokenType.Or) {
      const operator = this.consume(TokenType.Or).value;
      const right = this.parseLogicalAnd();
      left = { kind: "LogicalExpr", left, operator, right };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.current().type === TokenType.And) {
      const operator = this.consume(TokenType.And).value;
      const right = this.parseEquality();
      left = { kind: "LogicalExpr", left, operator, right };
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
      left = { kind: "BinaryExpr", left, operator, right };
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
      left = { kind: "BinaryExpr", left, operator, right };
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
      left = { kind: "BinaryExpr", left, operator, right };
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
      left = { kind: "BinaryExpr", left, operator, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.current().type === TokenType.Bang || this.current().type === TokenType.Minus) {
      const operator = this.consume(this.current().type).value;
      const argument = this.parseUnary(); // recursivo para lidar com !!true ou --5
      return { kind: "UnaryExpr", operator, argument };
    }
    return this.parseMemberExpr();
  }

  // ATENÇÂO: Acesso a propriedades (p.x) tem a precedência mais alta.
  // Precisamos criar um novo nível na nossa avaliação de expressões.
  private parseMemberExpr(): Expr {
    // Começa com o lado esquerdo (o objeto/variável)
    let object = this.parseCallMemberExpr();

    // Enquanto tiver ponto, colchetes ou interrogação, continua expandindo a expressão
    while (
      this.current().type === TokenType.Dot || 
      this.current().type === TokenType.LBracket || 
      this.current().type === TokenType.Question
    ) {
      if (this.current().type === TokenType.Question) {
        this.consume(TokenType.Question);
        object = { kind: "TryExpr", expression: object };
      } else if (this.current().type === TokenType.Dot) {
        this.consume(TokenType.Dot);
        const propertyName = this.consume(TokenType.Identifier).value;
        object = { kind: "MemberExpr", object, property: propertyName };
      } else if (this.current().type === TokenType.LBracket) {
        this.consume(TokenType.LBracket);
        const index = this.parseExpression();
        this.consume(TokenType.RBracket);
        object = { kind: "IndexExpr", object, index };
      }
    }

    return object;
  }

  private parsePrimary(): Expr {
    const token = this.current();

    if (token.type === TokenType.Number) {
      this.consume(TokenType.Number);
      return {
        kind: "NumericLiteral",
        value: parseFloat(token.value),
        isFloat: token.value.includes("."),
      };
    } else if (token.type === TokenType.String) {
      this.consume(TokenType.String);
      const content = token.value.slice(1, -1);
      
      const parts: (string | Expr)[] = [];
      let currentStr = "";
      let i = 0;
      
      while (i < content.length) {
        if (content[i] === '$' && content[i+1] === '{') {
          if (currentStr) parts.push(currentStr);
          currentStr = "";
          i += 2;
          
          let exprStr = "";
          let braceDepth = 1;
          while (i < content.length && braceDepth > 0) {
            if (content[i] === '{') braceDepth++;
            if (content[i] === '}') braceDepth--;
            if (braceDepth > 0) exprStr += content[i];
            i++;
          }
          
          // Lexer sub-chamada para interpolação
          const subLexer = new Lexer(exprStr);
          const subParser = new Parser(subLexer.tokenize());
          parts.push(subParser.parseExpression());
          
        } else {
          currentStr += content[i];
          i++;
        }
      }
      
      if (currentStr) parts.push(currentStr);
      
      if (parts.every(p => typeof p === "string")) {
        return { kind: "StringLiteral", value: content };
      }
      
      return { kind: "StringInterpolationExpr", parts };
    } else if (token.type === TokenType.True) {
      this.consume(TokenType.True);
      return { kind: "BooleanLiteral", value: true };
    } else if (token.type === TokenType.False) {
      this.consume(TokenType.False);
      return { kind: "BooleanLiteral", value: false };
    } else if (token.type === TokenType.LBracket) {
      this.consume(TokenType.LBracket);
      const elements: Expr[] = [];
      while (this.current().type !== TokenType.RBracket && this.current().type !== TokenType.EOF) {
        elements.push(this.parseExpression());
        if (this.current().type === TokenType.Comma) {
          this.consume(TokenType.Comma);
        }
      }
      this.consume(TokenType.RBracket);
      return { kind: "ArrayLiteral", elements };
    } else if (token.type === TokenType.LBrace) {
      this.consume(TokenType.LBrace);
      const properties: { key: string; value: Expr }[] = [];

      while (
        this.current().type !== TokenType.RBrace &&
        this.current().type !== TokenType.EOF
      ) {
        let key: string;
        if (this.current().type === TokenType.String) {
          key = this.consume(TokenType.String).value.slice(1, -1);
        } else if (this.current().type === TokenType.Identifier) {
          key = this.consume(TokenType.Identifier).value;
        } else {
          throw new Error(`SyntaxError: Expected string or identifier as Map key, got ${this.current().value}`);
        }

        this.consume(TokenType.Colon);
        const value = this.parseExpression();
        properties.push({ key, value });

        if (this.current().type === TokenType.Comma) {
          this.consume(TokenType.Comma);
        }
      }

      this.consume(TokenType.RBrace);
      return { kind: "MapLiteral", properties };
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
    } else if (token.type === TokenType.LParen) {
      this.consume(TokenType.LParen);
      const expr = this.parseExpression();
      this.consume(TokenType.RParen);
      return expr;
    } else if (token.type === TokenType.Pipe || token.type === TokenType.Or) {
      // Lambda expression: |param: Type, ...| { body }
      // Nota: || (Or) é tratado como lambda sem parâmetros
      return this.parseLambdaExpr();
    } else {
      throw new Error(`SyntaxError: Invalid expression '${token.value}'`);
    }
  }

  /**
   * Parseia uma lambda expression: |param1: Type1, param2: Type2| { body }
   * Os parâmetros têm tipagem obrigatória, igual a funções normais.
   */
  private parseLambdaExpr(): LambdaExpr {
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
          const paramName = this.consume(TokenType.Identifier).value;
          this.consume(TokenType.Colon);
          const typeAnnotation = this.parseTypeAnnotation();
          parameters.push({ name: paramName, typeAnnotation, isMut });
        } while (this.match(TokenType.Comma));
      }
      this.consume(TokenType.Pipe);
    }

    const body = this.parseBlock();
    return { kind: "LambdaExpr", parameters, body };
  }
}
