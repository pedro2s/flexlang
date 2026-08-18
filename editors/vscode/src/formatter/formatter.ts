/**
 * Formatador de Código Oficial para a Linguagem FlexLang.
 *
 * Implementa formatação determinística e legível:
 * - Ajuste preciso de indentação baseada em blocos delimitados por chaves `{}` e colchetes `[]`
 * - Normalização de espaçamentos em operadores binários, atribuições e setas (`->`, `=>`)
 * - Espaçamento consistente após vírgulas e dois-pontos
 * - Preservação e alinhamento de comentários de linha, bloco e documentação
 * - Remoção de espaços em branco residuais no final das linhas
 * - Limitação de linhas em branco consecutivas a no máximo 1 linha
 */

export interface FormatterOptions {
  /** Tamanho da indentação em espaços (padrão: 4) */
  indentSize?: number;
  /** Se deve usar tabulações em vez de espaços (padrão: false) */
  useTabs?: boolean;
}

export class FlexFormatter {
  private indentSize: number;
  private useTabs: boolean;

  constructor(options: FormatterOptions = {}) {
    this.indentSize = options.indentSize ?? 4;
    this.useTabs = options.useTabs ?? false;
  }

  /**
   * Formata o código fonte fornecido em FlexLang.
   */
  public format(sourceCode: string): string {
    const lines = sourceCode.split(/\r?\n/);
    const formattedLines: string[] = [];
    let indentLevel = 0;
    let consecutiveEmptyLines = 0;
    let insideBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      let rawLine = lines[i]!.trim();

      // Tratamento de comentários em bloco multilinhas
      if (insideBlockComment) {
        if (rawLine.includes("*/")) {
          insideBlockComment = false;
        }
        formattedLines.push(this.getIndent(indentLevel) + rawLine);
        continue;
      }

      if (rawLine.startsWith("/*") && !rawLine.includes("*/")) {
        insideBlockComment = true;
        formattedLines.push(this.getIndent(indentLevel) + rawLine);
        continue;
      }

      // Linha vazia
      if (rawLine.length === 0) {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines <= 1 && formattedLines.length > 0) {
          formattedLines.push("");
        }
        continue;
      }

      consecutiveEmptyLines = 0;

      // Normaliza cláusulas unidas como `}else{` ou `} else {`
      rawLine = rawLine.replace(/^\}\s*else\s*\{/g, "} else {");
      rawLine = rawLine.replace(/^\}\s*else\s+if/g, "} else if");

      // Cálculo de fechamento antes da linha (ex: `}`, `]`, `};`, `},`, `} else {`)
      const closingMatch = rawLine.match(/^(\}|\)|\])/);
      if (closingMatch && indentLevel > 0) {
        indentLevel--;
      }

      // Formata a linha internamente
      const formattedContent = this.formatLineContent(rawLine);

      // Adiciona linha com indentação
      formattedLines.push(this.getIndent(indentLevel) + formattedContent);

      // Calcula variação de indentação para as próximas linhas
      const openCount = (rawLine.match(/[\{\[\(]/g) || []).length;
      const closeCount = (rawLine.match(/[\}\]\)]/g) || []).length;

      const netChange = openCount - closeCount;
      if (closingMatch) {
        indentLevel += openCount;
      } else {
        indentLevel += netChange;
      }

      if (indentLevel < 0) {
        indentLevel = 0;
      }
    }

    // Garante que o arquivo termine com uma única quebra de linha
    return formattedLines.join("\n") + "\n";
  }

  /**
   * Retorna a string de indentação correspondente ao nível informado.
   */
  private getIndent(level: number): string {
    if (level <= 0) return "";
    if (this.useTabs) {
      return "\t".repeat(level);
    }
    return " ".repeat(level * this.indentSize);
  }

  /**
   * Formata os elementos internos de uma única linha de código.
   */
  private formatLineContent(line: string): string {
    // Se for comentário exclusivo de linha, mantém intacto
    if (line.startsWith("//") || line.startsWith("///") || line.startsWith("/*")) {
      return line;
    }

    // Isolar comentários no final da linha (ex: `let a = 1; // comentário`)
    let codePart = line;
    let commentPart = "";
    const commentIdx = line.indexOf("//");
    if (commentIdx !== -1) {
      const quotesBefore = (line.slice(0, commentIdx).match(/"/g) || []).length;
      if (quotesBefore % 2 === 0) {
        codePart = line.slice(0, commentIdx).trimEnd();
        commentPart = " " + line.slice(commentIdx).trim();
      }
    }

    let formatted = codePart;

    // 1. Espaçamento após vírgulas e ponto-e-vírgula
    formatted = formatted.replace(/,(\S)/g, ", $1");
    formatted = formatted.replace(/;(\S)/g, "; $1");

    // 2. Espaçamento em dois-pontos (exceto rotas HTTP dinâmicas `:id`)
    formatted = formatted.replace(/(\w+)\s*:\s*([^:\s])/g, "$1: $2");

    // 3. Setas e operadores de controle primeiro (para proteger -> e =>)
    formatted = formatted.replace(/\s*->\s*/g, " -> ");
    formatted = formatted.replace(/\s*=>\s*/g, " => ");

    // 4. Operadores de comparação compostos
    formatted = formatted.replace(/\s*==\s*/g, " == ");
    formatted = formatted.replace(/\s*!=\s*/g, " != ");
    formatted = formatted.replace(/\s*<=\s*/g, " <= ");
    formatted = formatted.replace(/\s*>=\s*/g, " >= ");
    formatted = formatted.replace(/\s*&&\s*/g, " && ");
    formatted = formatted.replace(/\s*\|\|\s*/g, " || ");

    // 5. Operadores de comparação simples (> e <) não compostos e não precedidos por - ou =
    formatted = formatted.replace(/([^=<\->\s])\s*>\s*([^=<>])/g, "$1 > $2");
    formatted = formatted.replace(/([^=<>])\s*<\s*([^=<\->\s])/g, "$1 < $2");

    // 6. Atribuição simples (=) evitando alterar ==, !=, <=, >=, =>
    formatted = formatted.replace(/([^=!<>])\s*=\s*([^=<>])/g, "$1 = $2");

    // 7. Operadores aritméticos binários (+, *, /, %)
    formatted = formatted.replace(/([a-zA-Z0-9_\)\]])\s*(\+|\*|\/|%)\s*([a-zA-Z0-9_\(\[])/g, "$1 $2 $3");
    // Subtração (não afeta ->)
    formatted = formatted.replace(/([a-zA-Z0-9_\)\]])\s*-(?!>)\s*([a-zA-Z0-9_\(\[])/g, "$1 - $2");

    // 8. Operador range (..) deve ficar colado: `0..10`
    formatted = formatted.replace(/\s*\.\.\s*/g, "..");

    // 9. Espaçamento após palavras-chave de controle
    const controlKeywords = ["if", "while", "for", "match", "return"];
    for (const kw of controlKeywords) {
      const regex = new RegExp(`\\b${kw}\\s*\\(`, "g");
      formatted = formatted.replace(regex, `${kw} (`);
    }

    // 10. Espaçamento de chaves de abertura `{`
    formatted = formatted.replace(/([^\s\{])\{/g, "$1 {");

    return formatted.trimEnd() + commentPart;
  }
}
