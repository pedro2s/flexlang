import {
	TokenType,
	type Token,
	type Stmt,
	type Expr,
	type VarDeclaration,
	type PrintStmt,
	type BlockStmt,
	type StringLiteral,
} from "./ast";

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
			} else if (this.current().type === TokenType.If) {
				statements.push(this.parseIfStatement());
			} else if (this.current().type === TokenType.For) {
				statements.push(this.parseForStatement());
			} else {
				throw new Error(
					`SyntaxError: Unknown statemtent '${this.current().value}'`,
				);
			}
		}
		return statements;
	}

	private parseBlock(): BlockStmt {
		this.consume(TokenType.LBrace);
		const body: Stmt[] = [];
		while (
			this.current().type !== TokenType.RBrace &&
			this.current().type !== TokenType.EOF
		) {
			// Para simplificar, chamamos um método genérico que avalia o tipo de statement atual
			// Aqui chamamos as lógicas de if, let, print, for de forma recursiva
			if (this.current().type === TokenType.Let) {
				body.push(this.parseVarDeclaration());
			} else if (this.current().type === TokenType.Print) {
				body.push(this.parsePrintStatement());
			} else if (this.current().type === TokenType.If) {
				body.push(this.parseIfStatement());
			} else if (this.current().type === TokenType.For) {
				body.push(this.parseForStatement());
			}
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
		const left = this.parsePrimary();

		if (this.current().type === TokenType.Plus) {
			const operator = this.consume(TokenType.Plus).value;
			const right = this.parsePrimary();
			return { kind: "BinaryExpr", left, operator, right };
		} else if (this.current().type === TokenType.EqEq) {
			const operator = this.consume(TokenType.EqEq).value;
			const right = this.parsePrimary();
			return { kind: "BinaryExpr", left, operator, right };
		} else if (this.current().type === TokenType.Gt) {
			const operator = this.consume(TokenType.Gt).value;
			const right = this.parsePrimary();
			return { kind: "BinaryExpr", left, operator, right };
		} else if (this.current().type === TokenType.Lt) {
			const operator = this.consume(TokenType.Lt).value;
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
		} else if (token.type === TokenType.String) {
			this.consume(TokenType.String);
			// Remove as aspas duplas ao redor da string
			const cleanValue = token.value.slice(1, -1);
			return { kind: "StringLiteral", value: cleanValue };
		} else if (token.type === TokenType.Identifier) {
			this.consume(TokenType.Identifier);
			return { kind: "Identifier", symbol: token.value };
		} else {
			throw new Error(`SyntaxError: Invalid expression '${token.value}'`);
		}
	}
}
