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
    [TokenType.While, /^while\b/],
    [TokenType.Break, /^break\b/],
    [TokenType.Continue, /^continue\b/],
    [TokenType.In, /^in\b/],
    [TokenType.Let, /^let\b/],
    [TokenType.Const, /^const\b/],
    [TokenType.Mut, /^mut\b/],
    [TokenType.Enum, /^enum\b/],
    [TokenType.Match, /^match\b/],
    [TokenType.Spawn, /^spawn\b/],
    [TokenType.Scope, /^scope\b/],
    [TokenType.Trait, /^trait\b/],
    [TokenType.Import, /^import\b/],
    [TokenType.From, /^from\b/],
    [TokenType.Print, /^print\b/],
    [TokenType.True, /^true\b/],
    [TokenType.False, /^false\b/],
    [TokenType.Catch, /^catch\b/],
    [TokenType.Identifier, /^[a-zA-Z_]\w*/],
    [TokenType.Number, /^\d+(\.\d+)?/],
    // A captura de string pura por regex foi removida. Faremos o parsing manual no laço!
    [TokenType.FatArrow, /^=>/],
    [TokenType.EqEq, /^==/],
    [TokenType.Question, /^\?/],
    [TokenType.NotEq, /^!=/],
    [TokenType.GtEq, /^>=/],
    [TokenType.LtEq, /^<=/],
    [TokenType.Assign, /^=/],
    [TokenType.And, /^&&/],
    [TokenType.Or, /^\|\|/],
    [TokenType.Pipe, /^\|/],
    [TokenType.Bang, /^!/],
    [TokenType.Modulo, /^%/],
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
    [TokenType.LBracket, /^\[/],
    [TokenType.RBracket, /^\]/],
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

      // Pular espaços em branco e quebras de linha
      if (/^\s+/.test(matchText)) {
        const spaces = matchText.match(/^\s+/)![0];
        advanceCursor(spaces);
        continue;
      }

      // Pular comentários de bloco (/* ... */)
      if (matchText.startsWith("/*")) {
        const endIdx = matchText.indexOf("*/");
        if (endIdx === -1) {
          throw new Error(`LexicalError: Unterminated multiline comment at line ${line}, col ${column}`);
        }
        advanceCursor(matchText.slice(0, endIdx + 2));
        continue;
      }

      // Pular comentários de linha (// ...)
      if (/^\/\/.*?(\r?\n|$)/.test(matchText)) {
        const comment = matchText.match(/^\/\/.*?(\r?\n|$)/)![0];
        advanceCursor(comment);
        continue;
      }

      // Parsing manual de String e Interpolação
      if (matchText.startsWith('"')) {
        // Encontramos o início de uma string. O Parser processará a string bruta e fará a
        // interpolação lá, criando um sub-parser recursivo. Aqui no Lexer apenas lemos a string inteira.
        let i = 1;
        let strVal = '"';
        while (i < matchText.length) {
          const char = matchText[i];
          strVal += char;
          if (char === '"' && matchText[i - 1] !== '\\') {
             break;
          }
          i++;
        }
        if (i >= matchText.length && !strVal.endsWith('"')) {
           throw new Error(`LexicalError: Unterminated string at line ${line}, col ${column}`);
        }
        
        this.tokens.push({ type: TokenType.String, value: strVal, line, column });
        advanceCursor(strVal);
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
