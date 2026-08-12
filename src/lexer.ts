import { TokenType, type Token } from "./ast";

export class Lexer {
	private tokens: Token[] = [];

	private static readonly tokenSpec: Array<[TokenType, RegExp]> = [
		[TokenType.If, /^if\b/],
		[TokenType.Else, /^else\b/],
		[TokenType.For, /^for\b/],
		[TokenType.In, /^in\b/],
		[TokenType.Let, /^let\b/],
		[TokenType.Print, /^print\b/],
		[TokenType.Identifier, /^[a-zA-Z_]\w*/],
		[TokenType.Number, /^\d+(\.\d+)?/],
		[TokenType.String, /^"[^"]*"/],
		[TokenType.EqEq, /^==/],
		[TokenType.Assign, /^=/],
		[TokenType.Plus, /^\+/],
		[TokenType.Gt, /^>/],
		[TokenType.Lt, /^</],
		[TokenType.DotDot, /^\.\./],
		[TokenType.Colon, /^:/],
		[TokenType.Semi, /^;/],
		[TokenType.LParen, /^\(/],
		[TokenType.RParen, /^\)/],
		[TokenType.LBrace, /^\{/],
		[TokenType.RBrace, /^\}/],
	];

	constructor(private code: string) {}

	public tokenize(): Token[] {
		let cursor = 0;

		while (cursor < this.code.length) {
			const matchText = this.code.slice(cursor);

			//   Pular espaços em branco e quebras de linha
			if (/^\s+/.test(matchText)) {
				const spaces = matchText.match(/^\s+/)![0];
				cursor += spaces.length;
				continue;
			}

			let matched = false;
			for (const [type, regex] of Lexer.tokenSpec) {
				const match = regex.exec(matchText);

				if (match) {
					this.tokens.push({ type, value: match[0] });
					cursor += match[0].length;
					matched = true;
					break;
				}
			}

			if (!matched) {
				throw new Error(
					`Unexpected token at position ${cursor}: '${matchText[0]}'`,
				);
			}
		}

		this.tokens.push({ type: TokenType.EOF, value: "EOF" });
		return this.tokens;
	}
}
