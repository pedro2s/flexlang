import * as fs from "fs";
import * as path from "path";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { modulePath } from "./modules/types";
import { FlexError } from "./diagnostics";
import type { ImportDeclaration, Stmt } from "./ast";

/**
 * Representa um arquivo fonte analisado no grafo de módulos.
 */
export interface SourceFile {
  /** Caminho absoluto normalizado do arquivo */
  filePath: string;
  /** AST completa do arquivo */
  ast: Stmt[];
  /** Declarações de importação presentes no arquivo */
  imports: ImportDeclaration[];
  /** Declarações de escopo superior (structs, funcs, enums, traits, impls) */
  declarations: Stmt[];
  /** Caminhos absolutos dos módulos locais dos quais este arquivo depende */
  localDependencies: string[];
}

/**
 * Grafo de dependências entre módulos compilados na FlexLang.
 */
export interface ModuleGraph {
  /** Caminho absoluto do arquivo de entrada principal */
  entryPath: string;
  /** Tabela de arquivos indexados pelo caminho absoluto */
  files: Map<string, SourceFile>;
  /** Ordem topológica de compilação/execução (folhas primeiro, entrada por último) */
  order: string[];
}

/**
 * Verifica se um nome de módulo se refere a um arquivo local no filesystem
 * (começa com "." ou "/").
 */
export function isLocalModule(moduleName: string): boolean {
  const clean = modulePath(moduleName);
  return clean.startsWith(".") || clean.startsWith("/");
}

/**
 * Resolve o caminho de um arquivo de módulo local a partir do arquivo importador.
 * Aceita nomes com ou sem extensão ".flex".
 */
export function resolveModuleFilePath(
  importerFilePath: string,
  moduleName: string,
  fileChecker?: ((p: string) => boolean) | Map<string, any>,
): string {
  const clean = modulePath(moduleName);
  const baseDir = path.dirname(importerFilePath);
  const targetPath = path.resolve(baseDir, clean);

  const check: (p: string) => boolean =
    fileChecker instanceof Map
      ? (p) => fileChecker.has(path.normalize(p))
      : fileChecker ?? ((p) => fs.existsSync(p) && fs.statSync(p).isFile());

  // 1. Tenta o caminho exato
  if (check(targetPath)) {
    return path.normalize(targetPath);
  }

  // 2. Tenta com a extensão .flex adicionada se ainda não a possuir
  if (!clean.endsWith(".flex")) {
    const withExt = targetPath + ".flex";
    if (check(withExt)) {
      return path.normalize(withExt);
    }
  }

  throw new Error(`ImportError: Module '${clean}' not found`);
}

/**
 * Carrega e constrói o grafo de dependências a partir do arquivo de entrada.
 * Realiza análise léxica, sintática, detecção de ciclos e ordenação topológica.
 */
export function loadModuleGraph(
  entryFilePath: string,
  customFileReader?: (filePath: string) => string,
  customFileChecker?: (filePath: string) => boolean,
): ModuleGraph {
  const readFile =
    customFileReader ??
    ((p: string) => {
      if (!fs.existsSync(p)) {
        throw new Error(`ImportError: File '${p}' not found`);
      }
      return fs.readFileSync(p, "utf-8");
    });

  const checkFile: (p: string) => boolean =
    customFileChecker ??
    (customFileReader
      ? (p: string) => {
          try {
            return readFile(p) !== undefined;
          } catch {
            return false;
          }
        }
      : (p: string) => fs.existsSync(p) && fs.statSync(p).isFile());

  const normalizedEntryPath = path.normalize(path.resolve(entryFilePath));
  const files = new Map<string, SourceFile>();
  const order: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(currentPath: string, parentPath?: string) {
    if (visiting.has(currentPath)) {
      const fileA = path.basename(parentPath ?? "");
      const fileB = path.basename(currentPath);
      throw new Error(`CompileError: circular import between '${fileA}' and '${fileB}'`);
    }

    if (visited.has(currentPath)) {
      return;
    }

    visiting.add(currentPath);

    const code = readFile(currentPath);
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, currentPath);
    const ast = parser.parse();

    const localDependencies: string[] = [];
    const imports: ImportDeclaration[] = [];
    const declarations: Stmt[] = [];

    for (const stmt of ast) {
      if (stmt.kind === "ImportDeclaration") {
        imports.push(stmt);
        if (isLocalModule(stmt.moduleName)) {
          const depPath = resolveModuleFilePath(currentPath, stmt.moduleName, checkFile);
          localDependencies.push(depPath);
        }
      } else if (
        stmt.kind === "StructDeclaration" ||
        stmt.kind === "FunctionDeclaration" ||
        stmt.kind === "EnumDeclaration" ||
        stmt.kind === "TraitDeclaration" ||
        stmt.kind === "ImplDeclaration"
      ) {
        declarations.push(stmt);
      }
    }

    const sourceFile: SourceFile = {
      filePath: currentPath,
      ast,
      imports,
      declarations,
      localDependencies,
    };

    files.set(currentPath, sourceFile);

    for (const dep of localDependencies) {
      visit(dep, currentPath);
    }

    visiting.delete(currentPath);
    visited.add(currentPath);
    order.push(currentPath);
  }

  visit(normalizedEntryPath);

  return {
    entryPath: normalizedEntryPath,
    files,
    order,
  };
}
