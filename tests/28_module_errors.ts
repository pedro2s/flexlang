/**
 * Testes unitários e negativos para o Sistema de Módulos Locais (RFC-006)
 */
import * as path from "path";
import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";

let passed = 0;
let failed = 0;

function assertThrows(fn: () => void, expectedPattern: RegExp, testName: string) {
  try {
    fn();
    console.error(`\x1b[31m[FAIL]\x1b[0m ${testName} (esperava erro, mas executou com sucesso)`);
    failed++;
  } catch (e: any) {
    if (expectedPattern.test(e.message)) {
      console.log(`\x1b[32m[PASS]\x1b[0m ${testName} -> ${e.message}`);
      passed++;
    } else {
      console.error(
        `\x1b[31m[FAIL]\x1b[0m ${testName}\n  Esperado: ${expectedPattern}\n  Recebido: ${e.message}`,
      );
      failed++;
    }
  }
}

console.log("\nExecutando testes de erros do sistema de módulos (RFC-006)...\n");

// 1. Teste de import circular
assertThrows(
  () => {
    const mockFiles: Record<string, string> = {
      "/virtual/a.flex": `import { b } from "./b";\nfunc a() {}`,
      "/virtual/b.flex": `import { a } from "./a";\nfunc b() {}`,
    };
    loadModuleGraph("/virtual/a.flex", (p) => {
      const content = mockFiles[p];
      if (!content) throw new Error(`File '${p}' not found`);
      return content;
    });
  },
  /CompileError: circular import between/,
  "Detecção de import circular",
);

// 2. Teste de módulo inexistente
assertThrows(
  () => {
    const mockFiles: Record<string, string> = {
      "/virtual/main.flex": `import { X } from "./modulo_inexistente";`,
    };
    loadModuleGraph("/virtual/main.flex", (p) => {
      const content = mockFiles[p];
      if (!content) throw new Error(`ImportError: Module '${p}' not found`);
      return content;
    });
  },
  /ImportError: Module '\.\/modulo_inexistente' not found/,
  "Import de módulo inexistente",
);

// 3. Teste de símbolo não exportado
assertThrows(
  () => {
    const mockFiles: Record<string, string> = {
      "/virtual/user.flex": `struct User { id: Int }`,
      "/virtual/main.flex": `import { NaoExiste } from "./user";`,
    };
    const graph = loadModuleGraph("/virtual/main.flex", (p) => {
      const content = mockFiles[p];
      if (!content) throw new Error(`ImportError: Module '${p}' not found`);
      return content;
    });
    const checker = new TypeChecker();
    checker.check(graph);
  },
  /ImportError: Symbol 'NaoExiste' not found in module '\.\/user'/,
  "Import de símbolo inexistente no módulo alvo",
);

// 4. Teste de colisão de símbolos globais entre módulos no GoTranspiler
assertThrows(
  () => {
    const mockFiles: Record<string, string> = {
      "/virtual/mod1.flex": `func process() -> Int { return 1; }`,
      "/virtual/mod2.flex": `func process() -> Int { return 2; }`,
      "/virtual/main.flex": `import { process } from "./mod1";\nimport { process } from "./mod2";`,
    };
    const graph = loadModuleGraph("/virtual/main.flex", (p) => {
      const content = mockFiles[p];
      if (!content) throw new Error(`ImportError: Module '${p}' not found`);
      return content;
    });
    const checker = new TypeChecker();
    const types = checker.check(graph);
    const transpiler = new GoTranspiler();
    transpiler.transpile(graph, types);
  },
  /CompileError: Duplicate symbol 'process' declared across modules/,
  "Detecção de colisão de símbolos globais no transpiler",
);

console.log(`\nTestes de Erro Finalizados: ${passed} passaram, ${failed} falharam.\n`);

if (failed > 0) {
  process.exit(1);
}
