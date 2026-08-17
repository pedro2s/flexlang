import * as fs from "fs";
import * as path from "path";
import type { Span } from "./ast";

/**
 * Erro estruturado do compilador FlexLang (RFC-014).
 * Carrega código de erro categorizado (E1xxx a E5xxx), localização exata no código fonte (Span)
 * e sugestão acionável opcional (help).
 */
export class FlexError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly span?: Span,
    readonly help?: string,
    readonly label?: string,
  ) {
    super(message);
    this.name = "FlexError";
  }
}

export interface FormatDiagnosticOptions {
  isTTY?: boolean;
  cwd?: string;
  readFile?: (filePath: string) => string;
}

/**
 * Formata um FlexError no estilo de diagnóstico legível (inspirado no Rust).
 * - Exibe cabeçalho com código e mensagem
 * - Exibe localização no formato arquivo:linha:coluna
 * - Exibe o trecho do código com número de linha e marcador ^^^
 * - Suporta expansão de tabs para alinhamento preciso
 * - Inclui sugestão acionável (help) quando disponível
 * - Emite cores ANSI somente se isTTY for verdadeiro
 */
export function formatDiagnostic(
  error: FlexError,
  options: FormatDiagnosticOptions = {},
): string {
  const isTTY =
    options.isTTY ??
    (typeof process !== "undefined" && Boolean(process.stderr?.isTTY));
  const cwd = options.cwd ?? (typeof process !== "undefined" ? process.cwd() : "");
  const readFile = options.readFile ?? ((p: string) => fs.readFileSync(p, "utf-8"));

  // Cores ANSI (somente para terminais interativos)
  const red = (s: string) => (isTTY ? `\x1b[1;31m${s}\x1b[0m` : s);
  const bold = (s: string) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s);
  const blue = (s: string) => (isTTY ? `\x1b[1;34m${s}\x1b[0m` : s);
  const cyan = (s: string) => (isTTY ? `\x1b[1;36m${s}\x1b[0m` : s);

  const header = `${red(`error[${error.code}]`)}: ${bold(error.message)}`;

  if (!error.span || !error.span.file) {
    if (error.help) {
      return `${header}\n\n${cyan("help:")} ${error.help}`;
    }
    return header;
  }

  const span = error.span;
  let displayPath = span.file;
  if (cwd && path.isAbsolute(span.file)) {
    const rel = path.relative(cwd, span.file);
    if (!rel.startsWith("..") && rel !== "") {
      displayPath = rel;
    }
  }

  const locLine = ` ${blue("-->")} ${displayPath}:${span.line}:${span.column}`;

  let fileContent = "";
  try {
    fileContent = readFile(span.file);
  } catch {
    // Se não for possível ler o arquivo, degrada para header + location
    if (error.help) {
      return `${header}\n${locLine}\n\n${cyan("help:")} ${error.help}`;
    }
    return `${header}\n${locLine}`;
  }

  const lines = fileContent.split(/\r?\n/);
  const lineIdx = span.line - 1;
  if (lineIdx < 0 || lineIdx >= lines.length) {
    if (error.help) {
      return `${header}\n${locLine}\n\n${cyan("help:")} ${error.help}`;
    }
    return `${header}\n${locLine}`;
  }

  const rawLine = lines[lineIdx]!;
  const gutterWidth = Math.max(String(span.line).length, 1);
  const emptyGutter = " ".repeat(gutterWidth) + ` ${blue("|")}`;
  const lineGutter = `${String(span.line).padStart(gutterWidth, " ")} ${blue("|")}`;

  // Calcular indentação e comprimento considerando tabs (tab = 4 spaces)
  const colStart = Math.max(1, span.column);
  const prefix = rawLine.slice(0, colStart - 1);
  let visualIndent = 0;
  for (const ch of prefix) {
    if (ch === "\t") {
      visualIndent += 4 - (visualIndent % 4);
    } else {
      visualIndent += 1;
    }
  }

  const visualLine = rawLine.replace(/\t/g, "    ");

  let length = 1;
  if (span.endLine === span.line && span.endColumn > span.column) {
    const segment = rawLine.slice(colStart - 1, span.endColumn - 1);
    let visualLength = 0;
    for (const ch of segment) {
      if (ch === "\t") {
        visualLength += 4 - (visualLength % 4);
      } else {
        visualLength += 1;
      }
    }
    length = Math.max(1, visualLength);
  } else if (span.endLine > span.line) {
    length = Math.max(1, visualLine.length - visualIndent);
  }

  const underline = red("^".repeat(Math.max(1, length)));
  const labelSuffix = error.label ? ` ${red(error.label)}` : "";
  const pointerLine = `${emptyGutter} ${" ".repeat(visualIndent)}${underline}${labelSuffix}`;

  const result = [
    header,
    locLine,
    emptyGutter,
    `${lineGutter} ${visualLine}`,
    pointerLine,
    emptyGutter,
  ];

  if (error.help) {
    result.push(`${cyan("help:")} ${error.help}`);
  }

  return result.join("\n");
}
