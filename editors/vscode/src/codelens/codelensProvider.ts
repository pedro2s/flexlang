import * as vscode from "vscode";

/**
 * Provedor de CodeLens para FlexLang.
 * Exibe botões interativos e dinâmicos no editor sobre pontos de entrada (como `func main()` ou `main();`).
 */
export class FlexCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const isTestFile = document.fileName.endsWith("_test.flex");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Identifica declaração de função main() ou chamada de topo
      if (line.match(/^func\s+main\s*\(/) || line.match(/^main\s*\(\s*\)\s*;/)) {
        const range = new vscode.Range(i, 0, i, line.length);

        // 1. Botão "▶ Executar (Interpreted)"
        const runLens = new vscode.CodeLens(range, {
          title: "▶ Executar (flex run)",
          command: "flexlang.runFile",
          arguments: [document.uri],
          tooltip: "Executa o arquivo atual via interpretador FlexLang",
        });
        codeLenses.push(runLens);

        // 2. Botão "⚡ Watch Mode"
        const watchLens = new vscode.CodeLens(range, {
          title: "⚡ Watch Mode",
          command: "flexlang.runWatch",
          arguments: [document.uri],
          tooltip: "Executa em modo watch com hot reload a cada alteração",
        });
        codeLenses.push(watchLens);

        // 3. Botão "📦 Compilar (Go)"
        const buildLens = new vscode.CodeLens(range, {
          title: "📦 Compilar Go",
          command: "flexlang.buildFile",
          arguments: [document.uri],
          tooltip: "Transpila para Go e compila para binário nativo",
        });
        codeLenses.push(buildLens);
      }

      // Se for arquivo de teste e encontrar funções test_*
      if (isTestFile && line.match(/^func\s+test_\w+\s*\(/)) {
        const range = new vscode.Range(i, 0, i, line.length);
        const testLens = new vscode.CodeLens(range, {
          title: "🧪 Executar Teste",
          command: "flexlang.runFile",
          arguments: [document.uri],
          tooltip: "Executa esta suíte de teste FlexLang",
        });
        codeLenses.push(testLens);
      }
    }

    return codeLenses;
  }
}
