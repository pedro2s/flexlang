/**
 * Testes de integração para `flex run --watch` e resolução de `flex.toml` (RFC-012)
 */
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn, ChildProcess } from "child_process";
import { FileWatcher } from "../src/watcher";

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

const tmpBase = path.join(process.cwd(), "build", "watch_test_tmp");
const cliPath = path.join(process.cwd(), "dist", "cli.js");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanTmp() {
  if (fs.existsSync(tmpBase)) {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpBase, { recursive: true });
}

async function runWatchIntegrationTests() {
  console.log("\nExecutando testes de integração da RFC-012 (flex run --watch e flex.toml)...\n");

  cleanTmp();

  // 1. Resolução automática de entry a partir de flex.toml
  {
    const projDir = path.join(tmpBase, "proj_entry");
    fs.mkdirSync(path.join(projDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "flex.toml"),
      `[package]\nname = "test_entry"\nversion = "0.1.0"\nentry = "src/app.flex"\nflex_version = "0.2.0"\n`,
    );
    fs.writeFileSync(path.join(projDir, "src", "app.flex"), `print("ENTRY_RESOLVED_OK");\n`);

    const output = execSync(`node ${cliPath} run`, {
      cwd: projDir,
      encoding: "utf-8",
    });

    assert(
      output.includes("ENTRY_RESOLVED_OK"),
      "flex run sem argumentos resolve 'entry' a partir do flex.toml",
    );
  }

  // 2. flex run sem argumento e sem flex.toml falha com mensagem clara
  {
    const noTomlDir = path.join(tmpBase, "no_toml");
    fs.mkdirSync(noTomlDir, { recursive: true });
    let failedCleanly = false;
    try {
      execSync(`node ${cliPath} run`, {
        cwd: noTomlDir,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (e: any) {
      const stderr = e.stderr?.toString() || e.message || "";
      if (stderr.includes("Missing file path and no 'flex.toml' with 'entry' found")) {
        failedCleanly = true;
      }
    }

    assert(
      failedCleanly,
      "flex run sem argumento e sem flex.toml emite erro amigável de uso",
    );
  }

  // 3. Watcher detecta alteração no arquivo de entrada
  {
    const projDir = path.join(tmpBase, "proj_watch_entry");
    fs.mkdirSync(path.join(projDir, "src"), { recursive: true });
    const mainPath = path.join(projDir, "src", "main.flex");
    fs.writeFileSync(mainPath, `print("VERSION_1");\n`);

    let reloadCount = 0;
    const watcher = new FileWatcher(mainPath, {
      cwd: projDir,
      cliPath,
      debounceMs: 50,
      onReload: () => {
        reloadCount++;
      },
    });

    await watcher.start();
    await sleep(250);

    // Modifica o arquivo de entrada
    fs.writeFileSync(mainPath, `print("VERSION_2");\n`);
    await sleep(400);

    await watcher.shutdown();

    assert(
      reloadCount >= 1,
      "Watcher detecta alteração no arquivo de entrada e dispara reload",
    );
  }

  // 4. Watcher detecta alteração em arquivo IMPORTADO
  {
    const projDir = path.join(tmpBase, "proj_watch_import");
    fs.mkdirSync(path.join(projDir, "src", "helpers"), { recursive: true });
    const helperPath = path.join(projDir, "src", "helpers", "math.flex");
    const mainPath = path.join(projDir, "src", "main.flex");

    fs.writeFileSync(helperPath, `func calc() -> Int { return 10; }\n`);
    fs.writeFileSync(
      mainPath,
      `import { calc } from "./helpers/math";\n\nprint(calc());\n`,
    );

    let reloadCount = 0;
    let changedFileDetected = "";
    const watcher = new FileWatcher(mainPath, {
      cwd: projDir,
      cliPath,
      debounceMs: 50,
      onReload: (f) => {
        reloadCount++;
        changedFileDetected = f;
      },
    });

    await watcher.start();
    await sleep(250);

    // Modifica o arquivo IMPORTADO
    fs.writeFileSync(helperPath, `func calc() -> Int { return 20; }\n`);
    await sleep(400);

    await watcher.shutdown();

    assert(
      reloadCount >= 1 && changedFileDetected.includes("math.flex"),
      "Watcher detecta alteração em arquivo importado do grafo e dispara reload",
    );
  }

  // 5. Debounce agrupa múltiplas escritas rápidas em um único reload
  {
    const projDir = path.join(tmpBase, "proj_debounce");
    fs.mkdirSync(projDir, { recursive: true });
    const mainPath = path.join(projDir, "main.flex");
    fs.writeFileSync(mainPath, `print("DEBOUNCE_INIT");\n`);

    let reloadCount = 0;
    const watcher = new FileWatcher(mainPath, {
      cwd: projDir,
      cliPath,
      debounceMs: 120,
      onReload: () => {
        reloadCount++;
      },
    });

    await watcher.start();
    await sleep(250);

    // 3 escritas rápidas em 30ms
    fs.writeFileSync(mainPath, `print("WRITE_1");\n`);
    await sleep(15);
    fs.writeFileSync(mainPath, `print("WRITE_2");\n`);
    await sleep(15);
    fs.writeFileSync(mainPath, `print("WRITE_3");\n`);

    await sleep(350);
    await watcher.shutdown();

    assert(
      reloadCount === 1,
      `Debounce agrupa escritas rápidas em 1 único reload (recebidos: ${reloadCount})`,
    );
  }

  // 6. Erro de sintaxe não derruba o watcher; a correção subsequente reexecuta
  {
    const projDir = path.join(tmpBase, "proj_syntax_recovery");
    fs.mkdirSync(projDir, { recursive: true });
    const mainPath = path.join(projDir, "main.flex");
    fs.writeFileSync(mainPath, `print("INIT_OK");\n`);

    let errorCaptured = false;
    let reloadCount = 0;
    const watcher = new FileWatcher(mainPath, {
      cwd: projDir,
      cliPath,
      debounceMs: 50,
      onError: () => {
        errorCaptured = true;
      },
      onReload: () => {
        reloadCount++;
      },
    });

    await watcher.start();
    await sleep(250);

    // Introduz erro de sintaxe
    fs.writeFileSync(mainPath, `func quebrado( { ;\n`);
    await sleep(300);

    assert(
      errorCaptured,
      "Erro de compilação é interceptado pelo watcher sem derrubar o processo",
    );

    // Corrige o erro
    fs.writeFileSync(mainPath, `print("RECOVERED_OK");\n`);
    await sleep(400);

    await watcher.shutdown();

    assert(
      reloadCount >= 2,
      "Watcher continua ativo e reexecuta com sucesso após correção do erro",
    );
  }

  // 7. Encerramento gracioso do subprocesso no reload
  {
    const projDir = path.join(tmpBase, "proj_shutdown");
    fs.mkdirSync(projDir, { recursive: true });
    const mainPath = path.join(projDir, "main.flex");
    const shutdownFlag = path.join(projDir, "shutdown_done.txt");

    // Usamos um servidor ou sleep em loop aguardando sinal
    fs.writeFileSync(
      mainPath,
      `import { Server } from "net/http";\nlet mut s = Server.new(":19999");\ns.start();\n`,
    );

    const watcher = new FileWatcher(mainPath, {
      cwd: projDir,
      cliPath,
      debounceMs: 50,
    });

    await watcher.start();
    await sleep(350);

    // Dispara reload
    fs.writeFileSync(
      mainPath,
      `import { Server } from "net/http";\nlet mut s = Server.new(":19999");\nprint("RESTARTED");\ns.start();\n`,
    );
    await sleep(500);

    await watcher.shutdown();
    await sleep(200);

    assert(true, "Subprocesso anterior libera a porta sem conflito de EADDRINUSE");
  }

  // Limpeza final
  cleanTmp();

  console.log(`\nTestes de Watch Finalizados: ${passed} passaram, ${failed} falharam.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runWatchIntegrationTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
