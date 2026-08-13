/**
 * Parity gate (RFC-001 / test_plan.md §2.2)
 *
 * Para cada `tests/*.flex`, roda os DOIS caminhos — interpretado (`flex run`) e
 * compilado (`flex build` + binário Go) — e falha se as saídas divergirem.
 *
 * Diretivas suportadas no topo do `.flex`:
 *   // parity: nondeterministic <razão>   -> compila e executa, mas não compara stdout
 *                                           (usado por testes de concorrência, cuja
 *                                            ordem de saída não é determinística em Go)
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { Interpreter } from "../src/interpreter";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";

const testsDir = path.join(process.cwd(), "tests");
const RUN_TIMEOUT_MS = 30_000;

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

/** Go pode não estar no PATH do shell que roda a suíte (ex: instalação em /usr/local/go). */
function findGo(): string | null {
  const candidates = [
    process.env.GO_BIN,
    "go",
    "/usr/local/go/bin/go",
    path.join(os.homedir(), "go", "bin", "go"),
    "/usr/lib/go/bin/go",
    "/snap/bin/go",
  ].filter((c): c is string => !!c);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["version"], { stdio: "pipe" });
      return candidate;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

function parityMode(source: string): { mode: "compare" | "nondeterministic"; reason: string } {
  const match = source.match(/^\s*\/\/\s*parity:\s*(\S+)\s*(.*)$/m);
  if (!match) return { mode: "compare", reason: "" };

  const declared = match[1]!;
  if (declared !== "nondeterministic") {
    throw new Error(`Diretiva de paridade desconhecida: '${declared}'`);
  }
  return { mode: "nondeterministic", reason: (match[2] ?? "").trim() };
}

function diff(expected: string, actual: string): string {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const lines: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      lines.push(`  linha ${i + 1}:`);
      lines.push(`    interpretado: ${JSON.stringify(a[i] ?? null)}`);
      lines.push(`    compilado:    ${JSON.stringify(b[i] ?? null)}`);
    }
  }
  return lines.join("\n");
}

async function runParity() {
  const goBin = findGo();
  if (!goBin) {
    console.error(
      red("\n[ERRO] Go não encontrado.") +
        " O parity gate precisa do toolchain Go para compilar a saída do transpiler.\n" +
        "       Instale o Go ou aponte a variável GO_BIN para o binário.\n",
    );
    process.exit(1);
  }

  const flexFiles = fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith(".flex"))
    .sort();

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "flex-parity-"));
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`\nParity gate: ${flexFiles.length} testes (interpretado vs compilado)\n`);

  for (const file of flexFiles) {
    const sourceCode = fs.readFileSync(path.join(testsDir, file), "utf-8");
    const { mode, reason } = parityMode(sourceCode);

    // --- Front-end: lexer, parser e checker são compartilhados pelos dois modos ---
    let ast;
    let types;
    try {
      const parser = new Parser(new Lexer(sourceCode).tokenize());
      ast = parser.parse();
      const checker = new TypeChecker();
      types = checker.check(ast);
    } catch (e: any) {
      // O programa é rejeitado antes do codegen: os dois modos falham de forma
      // idêntica por construção, então não há Go para comparar.
      console.log(`${green("[PASS]")} ${file} ${dim(`(rejeitado pelo checker: ${e.message})`)}`);
      passed++;
      continue;
    }

    // --- Modo interpretado ---
    let interpreted = "";
    try {
      const interpreter = new Interpreter((msg: string) => {
        interpreted += msg + "\n";
      });
      await interpreter.run(ast);
    } catch (e: any) {
      interpreted += e.message + "\n";
    }

    // --- Modo compilado ---
    const baseName = file.replace(".flex", "");
    const goPath = path.join(workDir, `${baseName}.go`);
    const binPath = path.join(workDir, baseName);

    let goCode: string;
    try {
      goCode = new GoTranspiler().transpile(ast, types);
    } catch (e: any) {
      console.log(`${red("[FAIL]")} ${file} — transpiler falhou: ${e.message}`);
      failed++;
      continue;
    }
    fs.writeFileSync(goPath, goCode, "utf-8");

    try {
      execFileSync(goBin, ["build", "-o", binPath, goPath], { stdio: "pipe", timeout: RUN_TIMEOUT_MS });
    } catch (e: any) {
      console.log(`${red("[FAIL]")} ${file} — 'go build' falhou:`);
      console.log(String(e.stderr ?? e.message).trim());
      console.log(dim(`  Go gerado: ${goPath}`));
      failed++;
      continue;
    }

    let compiled: string;
    try {
      compiled = execFileSync(binPath, [], { encoding: "utf-8", timeout: RUN_TIMEOUT_MS, stdio: "pipe" });
    } catch (e: any) {
      console.log(`${red("[FAIL]")} ${file} — binário Go falhou na execução:`);
      console.log(String(e.stderr ?? e.message).trim());
      console.log(dim(`  Go gerado: ${goPath}`));
      failed++;
      continue;
    }

    if (mode === "nondeterministic") {
      console.log(`${yellow("[SKIP]")} ${file} ${dim(`(compila e executa; stdout não comparado: ${reason})`)}`);
      skipped++;
      continue;
    }

    if (interpreted === compiled) {
      console.log(`${green("[PASS]")} ${file}`);
      passed++;
    } else {
      console.log(`${red("[FAIL]")} ${file} — saída interpretada difere da compilada:`);
      console.log(diff(interpreted, compiled));
      console.log(dim(`  Go gerado: ${goPath}`));
      failed++;
    }
  }

  console.log(
    `\nParity gate: ${passed} passaram, ${failed} falharam${skipped > 0 ? `, ${skipped} sem comparação de stdout` : ""}.\n`,
  );

  if (failed > 0) {
    process.exit(1);
  }
  fs.rmSync(workDir, { recursive: true, force: true });
}

runParity();
