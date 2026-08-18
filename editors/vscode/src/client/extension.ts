import * as vscode from "vscode";
import * as path from "path";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { FlexCodeLensProvider } from "../codelens/codelensProvider";

let client: LanguageClient | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  // 1. Configura e Inicializa o Servidor de Linguagem (LSP)
  const serverModule = context.asAbsolutePath(path.join("dist", "server", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "flexlang" }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.flex"),
    },
  };

  client = new LanguageClient(
    "flexlangServer",
    "FlexLang Language Server",
    serverOptions,
    clientOptions
  );

  client.start();

  // 2. Registra o Provedor de CodeLens
  const codeLensProvider = new FlexCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "flexlang", scheme: "file" },
      codeLensProvider
    )
  );

  // 3. Registra a Barra de Status Interativa
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(zap) FlexLang";
  statusBarItem.tooltip = "FlexLang Language Server Ativo (Clique para executar o arquivo atual)";
  statusBarItem.command = "flexlang.runFile";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Atualiza visibilidade da status bar de acordo com o editor ativo
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.languageId === "flexlang") {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  // 4. Registra os Comandos Oficiais da Extensão
  context.subscriptions.push(
    vscode.commands.registerCommand("flexlang.runFile", (uri?: vscode.Uri) => {
      runFlexCommand("run", uri);
    }),

    vscode.commands.registerCommand("flexlang.runWatch", (uri?: vscode.Uri) => {
      runFlexCommand("run --watch", uri);
    }),

    vscode.commands.registerCommand("flexlang.buildFile", (uri?: vscode.Uri) => {
      runFlexCommand("build", uri);
    }),

    vscode.commands.registerCommand("flexlang.runTests", () => {
      runFlexCommand("test");
    }),

    vscode.commands.registerCommand("flexlang.restartServer", async () => {
      if (client) {
        await client.stop();
        client.start();
        vscode.window.showInformationMessage("⚡ Servidor de Linguagem FlexLang reiniciado com sucesso!");
      }
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

/**
 * Executa comandos da CLI FlexLang no terminal integrado do VSCode.
 */
function runFlexCommand(action: string, targetUri?: vscode.Uri): void {
  const editor = vscode.window.activeTextEditor;
  const uri = targetUri ?? editor?.document.uri;

  const config = vscode.workspace.getConfiguration("flexlang");
  const cliPath = config.get<string>("cliPath", "flex");

  const terminalName = "FlexLang";
  let terminal = vscode.window.terminals.find((t) => t.name === terminalName);
  if (!terminal) {
    terminal = vscode.window.createTerminal(terminalName);
  }

  terminal.show();

  if (action === "test") {
    terminal.sendText(`${cliPath} test`);
    return;
  }

  if (uri && uri.fsPath) {
    terminal.sendText(`${cliPath} ${action} "${uri.fsPath}"`);
  } else {
    vscode.window.showWarningMessage("Nenhum arquivo FlexLang ativo para executar.");
  }
}
