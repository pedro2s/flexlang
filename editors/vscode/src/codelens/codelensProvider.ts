import * as vscode from "vscode";

/**
 * Provedor de CodeLens para FlexLang.
 * Exibe botões interativos e dinâmicos no editor sobre pontos de entrada (como `func main()` ou `#[test]`).
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

    const isTestFile = document.fileName.endsWith("_test.flex") || document.fileName.includes(".test.");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      const prevLine = i > 0 ? lines[i - 1]!.trim() : "";

      // 1. Identifica declaração de função main() ou chamada de topo
      if (line.match(/^func\s+main\s*\(/) || line.match(/^main\s*\(\s*\)\s*;/)) {
        const range = new vscode.Range(i, 0, i, lines[i]!.length);

        // Botão "▶ Executar (flex run)"
        codeLenses.push(new vscode.CodeLens(range, {
          title: "▶ Executar (flex run)",
          command: "flexlang.runFile",
          arguments: [document.uri],
          tooltip: "Executa o arquivo atual via interpretador FlexLang",
        }));

        // Botão "⚡ Watch Mode"
        codeLenses.push(new vscode.CodeLens(range, {
          title: "⚡ Watch Mode",
          command: "flexlang.runWatch",
          arguments: [document.uri],
          tooltip: "Executa em modo watch com hot reload a cada alteração",
        }));

        // Botão "📦 Compilar Go"
        codeLenses.push(new vscode.CodeLens(range, {
          title: "📦 Compilar Go",
          command: "flexlang.buildFile",
          arguments: [document.uri],
          tooltip: "Transpila para Go e compila para binário nativo",
        }));

        // Botão "🛡️ Checar Tipos"
        codeLenses.push(new vscode.CodeLens(range, {
          title: "🛡️ Checar Tipos",
          command: "flexlang.checkFile",
          arguments: [document.uri],
          tooltip: "Executa a verificação estática de tipos e sintaxe (flex check)",
        }));
      }

      // 2. Identifica testes unitários (#[test] ou func test_*)
      const hasTestAttribute = prevLine.startsWith("#[test") || line.startsWith("#[test");
      const isTestFunction = line.match(/^func\s+test_\w+\s*\(/) || (hasTestAttribute && line.match(/^func\s+\w+\s*\(/));

      if (isTestFunction || (isTestFile && line.match(/^func\s+\w+\s*\(/))) {
        const targetLineIndex = hasTestAttribute && prevLine.startsWith("#[test") ? i - 1 : i;
        const range = new vscode.Range(targetLineIndex, 0, targetLineIndex, lines[targetLineIndex]!.length);

        // Botão "🧪 Executar Teste"
        codeLenses.push(new vscode.CodeLens(range, {
          title: "🧪 Executar Teste",
          command: "flexlang.runTestFile",
          arguments: [document.uri],
          tooltip: "Executa os testes unitários deste arquivo via flex test",
        }));

        // Botão "⚡ Teste Nativo (Go)"
        codeLenses.push(new vscode.CodeLens(range, {
          title: "⚡ Teste Nativo (Go)",
          command: "flexlang.runNativeTestFile",
          arguments: [document.uri],
          tooltip: "Executa os testes compilados nativamente via Go (flex test --native)",
        }));
      }
    }

    return codeLenses;
  }
}
