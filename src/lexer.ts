import { TokenType, type Token } from "./ast";

export class Lexer {
  private tokens: Token[] = [];

  private static readonly tokenSpec: Array<[TokenType, RegExp]> = [
    [TokenType.Impl, /^impl\b/],
    [TokenType.Self, /^self\b/],
    [TokenType.Struct, /^struct\b/],
    [TokenType.DotDot, /^\.\./],
    [TokenType.Dot, /^\./],
    [TokenType.Func, /^func\b/],
    [TokenType.Return, /^return\b/],
    [TokenType.Arrow, /^->/], // Atenção: tem que vir antes de subtrações (-) se houver
    [TokenType.Comma, /^,/],
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
    [TokenType.NotEq, /^!=/],
    [TokenType.GtEq, /^>=/],
    [TokenType.LtEq, /^<=/],
    [TokenType.Assign, /^=/],
    [TokenType.Plus, /^\+/],
    [TokenType.Minus, /^\-/],
    [TokenType.Star, /^\*/],
    [TokenType.Slash, /^\//],
    [TokenType.Gt, /^>/],
    [TokenType.Lt, /^</],
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
    let line = 1;
    let column = 1;

    const advanceCursor = (text: string) => {
      for (const char of text) {
        if (char === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }
      cursor += text.length;
    };

    while (cursor < this.code.length) {
      const matchText = this.code.slice(cursor);

      //   Pular espaços em branco e quebras de linha
      if (/^\s+/.test(matchText)) {
        const spaces = matchText.match(/^\s+/)![0];
        advanceCursor(spaces);
        continue;
      }

      //   Pular comentários de linha (// ...)
      if (/^\/\/.*?(\r?\n|$)/.test(matchText)) {
        const comment = matchText.match(/^\/\/.*?(\r?\n|$)/)![0];
        advanceCursor(comment);
        continue;
      }

      let matched = false;
      for (const [type, regex] of Lexer.tokenSpec) {
        const match = matchText.match(regex);

        if (match) {
          this.tokens.push({ type, value: match[0], line, column });
          advanceCursor(match[0]);
          matched = true;
          break;
        }
      }

      if (!matched) {
        throw new Error(
          `LexicalError: Unexpected token '${matchText[0]}' at line ${line}, col ${column}`,
        );
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: "EOF", line, column });
    return this.tokens;
  }
}
