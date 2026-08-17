/**
 * Testes unitários e de integração para o Sistema de Diagnósticos do Compilador (RFC-014)
 */
import { FlexError, formatDiagnostic } from "../src/diagnostics";
import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { Parser } from "../src/parser";
import { Lexer } from "../src/lexer";
import type { Span } from "../src/ast";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${testName}`);
    passed++;
  } else {
    console.error(`\x1b[31m[FAIL]\x1b[0m ${testName}${detail ? ` (${detail})` : ""}`);
    failed++;
  }
}

console.log("\nExecutando testes da RFC-014 (Diagnósticos do Compilador)...\n");

// 1. Spans em nós da AST
{
  const code = `let preco: Float = 19;`;
  const ast = new Parser(new Lexer(code).tokenize(), "/path/to/file.flex").parse();
  const varDecl = ast[0];
  assert(
    varDecl.kind === "VarDeclaration" && !!varDecl.span,
    "Nó VarDeclaration possui Span preenchido",
  );
  if (varDecl.kind === "VarDeclaration" && varDecl.span) {
    assert(varDecl.span.file === "/path/to/file.flex", "Span contém caminho do arquivo correto");
    assert(varDecl.span.line === 1, "Span line começa em 1");
    assert(varDecl.span.column === 1, "Span column começa em 1");
  }
}

// 2. Erro em arquivo importado aponta o arquivo importado com linha e coluna corretas
{
  const mockFiles: Record<string, string> = {
    "/project/src/main.flex": `import { calcular } from "./calc";\n\nfunc main() {\n  calcular();\n}`,
    "/project/src/calc.flex": `func calcular() {\n  let x: String = 123;\n}`,
  };

  let caughtError: any = null;
  try {
    const graph = loadModuleGraph("/project/src/main.flex", (p) => {
      const content = mockFiles[p];
      if (!content) throw new Error(`File '${p}' not found`);
      return content;
    });
    const checker = new TypeChecker();
    checker.check(graph);
  } catch (e: any) {
    caughtError = e;
  }

  assert(caughtError instanceof FlexError, "Erro lançado é instância de FlexError");
  assert(caughtError?.code === "E2001", "Código do erro é E2001");
  assert(
    caughtError?.span?.file === "/project/src/calc.flex",
    "Span aponta para o arquivo importado (/project/src/calc.flex) e não para a entrada",
  );
  assert(caughtError?.span?.line === 2, "Span aponta para a linha 2 do arquivo importado");

  // Formatar diagnóstico com mock de leitura
  const formatted = formatDiagnostic(caughtError, {
    isTTY: false,
    cwd: "/project",
    readFile: (p) => mockFiles[p] || "",
  });

  assert(
    formatted.includes("--> src/calc.flex:2:"),
    "Diagnóstico formatado inclui caminho relativo correto do arquivo importado",
  );
  assert(
    formatted.includes("let x: String = 123;"),
    "Diagnóstico formatado inclui trecho do código do arquivo importado",
  );
}

// 3. Sem TTY, saída não contém sequências ANSI de escape
{
  const err = new FlexError(
    "E2001",
    "cannot assign value of type `Int` to variable of type `Float`",
    { file: "/virtual/test.flex", line: 1, column: 20, endLine: 1, endColumn: 22 },
    "literais decimais são Float — use `19.0`",
  );

  const formattedNoTTY = formatDiagnostic(err, {
    isTTY: false,
    readFile: () => "let preco: Float = 19;",
  });

  assert(!formattedNoTTY.includes("\x1b["), "Saída sem TTY não contém caracteres de escape ANSI");
  assert(formattedNoTTY.includes("error[E2001]:"), "Contém cabeçalho formatado error[E2001]");
  assert(formattedNoTTY.includes("help: literais decimais"), "Contém texto de sugestão help");
}

// 4. Com TTY, saída contém sequências ANSI
{
  const err = new FlexError(
    "E2001",
    "cannot assign Int to Float",
    { file: "/virtual/test.flex", line: 1, column: 1, endLine: 1, endColumn: 5 },
  );

  const formattedTTY = formatDiagnostic(err, {
    isTTY: true,
    readFile: () => "let x = 1;",
  });

  assert(formattedTTY.includes("\x1b["), "Saída com TTY contém sequências de escape ANSI");
}

// 5. Alinhamento correto com tabs
{
  const tabLine = "\t\tlet x: Int = \"errado\";";
  const err = new FlexError(
    "E2001",
    "type mismatch",
    { file: "/virtual/tab.flex", line: 1, column: 16, endLine: 1, endColumn: 24 },
  );

  const formatted = formatDiagnostic(err, {
    isTTY: false,
    readFile: () => tabLine,
  });

  // "\t\t" (8 espaços visuais) + "let x: Int = " (13 caracteres) = 21 espaços antes do ^^^^
  const lines = formatted.split("\n");
  const pointerLine = lines.find((l) => l.includes("^^^^"));
  assert(!!pointerLine, "Linha de ponteiro ^^^^ encontrada");
  assert(!pointerLine?.includes("\t"), "Linha de ponteiro converteu tabs para manter alinhamento");
}

// 6. Ausência de vazamento de stack trace
{
  const err = new FlexError("E2001", "type error", {
    file: "/test.flex",
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 5,
  });
  const output = formatDiagnostic(err, { isTTY: false, readFile: () => "test;" });
  assert(!output.includes("at TypeChecker"), "Nenhum frame interno 'at TypeChecker' no diagnóstico");
  assert(!output.includes("dist/cli.js"), "Nenhum caminho de dist/ no diagnóstico");
}

// 7. Diagnóstico amigável ao usar sintaxe legada '=>' no match (RFC-016)
{
  const code = `
  match x {
    Option.Some(v) => {
      print(v);
    },
    Option.None => {
      print("none");
    }
  }`;

  let caughtError: any = null;
  try {
    new Parser(new Lexer(code).tokenize(), "/test.flex").parse();
  } catch (e: any) {
    caughtError = e;
  }

  assert(caughtError instanceof FlexError, "Parser lança FlexError ao encontrar '=>' em match");
  assert(caughtError?.code === "E1002", "Código do erro é E1002");
  assert(
    caughtError?.message.includes("sintaxe '=>' foi removida"),
    "Mensagem explica remoção da sintaxe '=>'",
  );
  assert(
    caughtError?.help?.includes("remova o '=>'"),
    "Help sugere remover o '=>' e manter apenas o bloco",
  );
}

// 8. Diagnóstico amigável de migração de server.route -> server.get/post/etc (RFC-011)
{
  const code = `
  import { Server, Request, Response } from "net/http";
  let mut server = Server.new(":8080");
  func h(req: Request, mut res: Response) {}
  server.route("/users", h);
  `;

  let caughtError: any = null;
  try {
    const ast = new Parser(new Lexer(code).tokenize(), "/test.flex").parse();
    new TypeChecker().check(ast);
  } catch (e: any) {
    caughtError = e;
  }

  assert(caughtError instanceof FlexError, "TypeChecker lança FlexError ao encontrar 'server.route'");
  assert(caughtError?.code === "E2024", "Código do erro é E2024");
  assert(
    caughtError?.message.includes("`server.route` foi removido"),
    "Mensagem explica remoção de `server.route`",
  );
  assert(
    caughtError?.help?.includes("veja RFC-011"),
    "Help referencia a RFC-011",
  );
}

console.log(`\nTestes de Diagnósticos Finalizados: ${passed} passaram, ${failed} falharam.\n`);

if (failed > 0) {
  process.exit(1);
}
