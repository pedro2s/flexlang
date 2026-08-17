import * as fs from "fs";
import * as path from "path";
import { fork, ChildProcess } from "child_process";
import { loadModuleGraph } from "./loader";
import { FlexError, formatDiagnostic } from "./diagnostics";

export interface WatcherOptions {
  cwd?: string;
  debounceMs?: number;
  cliPath?: string;
  onChildStart?: (child: ChildProcess) => void;
  onReload?: (changedFile: string) => void;
  onError?: (error: unknown) => void;
}

export class FileWatcher {
  private entryPath: string;
  private options: WatcherOptions;
  private currentChild: ChildProcess | null = null;
  private isStoppingChild = false;
  private watchedFiles: Map<string, { watcher: fs.FSWatcher; mtimeMs: number }> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private activeGraphFiles: string[] = [];

  constructor(entryPath: string, options: WatcherOptions = {}) {
    this.entryPath = path.resolve(entryPath);
    this.options = {
      cwd: options.cwd || process.cwd(),
      debounceMs: options.debounceMs ?? 80,
      cliPath: options.cliPath || process.argv[1],
      ...options,
    };
  }

  public async start(): Promise<void> {
    const cleanupSignals = () => {
      this.shutdown();
    };

    process.once("SIGINT", cleanupSignals);
    process.once("SIGTERM", cleanupSignals);

    try {
      const graph = loadModuleGraph(this.entryPath);
      this.activeGraphFiles = Array.from(graph.files.keys());
    } catch (e) {
      if (e instanceof FlexError) {
        console.error(formatDiagnostic(e, { isTTY: process.stderr.isTTY }));
      } else {
        console.error(e);
      }
      this.activeGraphFiles = [this.entryPath];
    }

    this.updateWatchedFiles(this.activeGraphFiles);

    const relCount = this.activeGraphFiles.length;
    console.log(
      `[flex] watch: observando ${relCount} arquivo${relCount === 1 ? "" : "s"} · Ctrl+C para sair\n`,
    );

    this.spawnChild();
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Fecha todos os observadores de arquivo
    for (const { watcher } of this.watchedFiles.values()) {
      try {
        watcher.close();
      } catch {}
    }
    this.watchedFiles.clear();

    // Encerra processo filho graciosamente
    await this.killCurrentChild();
  }

  private updateWatchedFiles(files: string[]): void {
    const nextFilesSet = new Set(files.map((f) => path.resolve(f)));

    // Remove arquivos que saíram do grafo
    for (const [filePath, { watcher }] of this.watchedFiles.entries()) {
      if (!nextFilesSet.has(filePath)) {
        try {
          watcher.close();
        } catch {}
        this.watchedFiles.delete(filePath);
      }
    }

    // Adiciona novos arquivos ao watcher
    for (const filePath of nextFilesSet) {
      if (!this.watchedFiles.has(filePath) && fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          const watcher = fs.watch(filePath, (eventType) => {
            this.handleFileEvent(filePath, eventType);
          });
          this.watchedFiles.set(filePath, { watcher, mtimeMs: stat.mtimeMs });
        } catch (e) {
          // Arquivo pode ter sumido ou não ter permissão
        }
      }
    }
  }

  private handleFileEvent(filePath: string, _eventType: string): void {
    if (this.isShuttingDown) return;

    // Checa se o arquivo de fato mudou (mtimeMs)
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        const record = this.watchedFiles.get(filePath);
        if (record && stat.mtimeMs === record.mtimeMs) {
          return; // Evento falso/sem alteração de conteúdo
        }
        if (record) {
          record.mtimeMs = stat.mtimeMs;
        }
      } catch {
        return;
      }
    }

    // Debounce de 80ms
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.triggerReload(filePath);
    }, this.options.debounceMs);
  }

  private async triggerReload(changedFile: string): Promise<void> {
    if (this.isShuttingDown) return;

    const relPath = path.relative(this.options.cwd || process.cwd(), changedFile) || changedFile;

    console.log(`\n  ────────────────────────────────────────`);
    console.log(`  ↻ ${relPath} alterado\n`);

    if (this.options.onReload) {
      this.options.onReload(changedFile);
    }

    await this.killCurrentChild();

    if (this.isShuttingDown) return;

    // Tenta reconstruir o grafo
    try {
      const graph = loadModuleGraph(this.entryPath);
      this.activeGraphFiles = Array.from(graph.files.keys());
      this.updateWatchedFiles(this.activeGraphFiles);
    } catch (e) {
      // Erro de compilação ou import quebrado não derruba o watcher
      if (e instanceof FlexError) {
        console.error(formatDiagnostic(e, { isTTY: process.stderr.isTTY }));
      } else if (e instanceof Error) {
        console.error(`Erro: ${e.message}\n`);
      } else {
        console.error(e);
      }
      if (this.options.onError) {
        this.options.onError(e);
      }
      return; // Permanece observando os arquivos já monitorados
    }

    this.spawnChild();
  }

  private spawnChild(): void {
    if (this.isShuttingDown) return;

    const cliPath = this.options.cliPath || process.argv[1];
    const execArgv = process.execArgv || [];

    // Executa em subprocesso isolado com stdio herdado
    const child = fork(cliPath, ["run", this.entryPath], {
      cwd: this.options.cwd,
      stdio: "inherit",
      execArgv,
      env: {
        ...process.env,
        FLEX_WATCH_CHILD: "1",
      },
    });

    this.currentChild = child;
    if (this.options.onChildStart) {
      this.options.onChildStart(child);
    }

    child.on("exit", () => {
      if (this.currentChild === child) {
        this.currentChild = null;
      }
    });
  }

  private async killCurrentChild(): Promise<void> {
    const child = this.currentChild;
    if (!child || child.killed || child.exitCode !== null) {
      this.currentChild = null;
      return;
    }

    if (this.isStoppingChild) return;
    this.isStoppingChild = true;

    await new Promise<void>((resolve) => {
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          this.currentChild = null;
          this.isStoppingChild = false;
          resolve();
        }
      };

      child.once("exit", finish);

      // Envia SIGTERM para permitir graceful shutdown (RFC-008 on_shutdown)
      try {
        child.kill("SIGTERM");
      } catch {
        finish();
        return;
      }

      // Se o processo não sair em 3 segundos, envia SIGKILL forçado
      const forceKillTimer = setTimeout(() => {
        if (!resolved && child.exitCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {}
        }
        finish();
      }, 3000);

      // Não segura o event loop caso tudo finalize
      if (forceKillTimer.unref) {
        forceKillTimer.unref();
      }
    });
  }
}

export function startWatcher(entryPath: string, options?: WatcherOptions): FileWatcher {
  const watcher = new FileWatcher(entryPath, options);
  watcher.start();
  return watcher;
}
