---
title: Configuração do VSCode & Tooling
description: Configure a extensão oficial do VSCode com suporte a LSP, realce de sintaxe e CodeLens.
---

A FlexLang possui suporte oficial de primeira classe para o **Visual Studio Code** através da extensão integrada no repositório (`editors/vscode`).

---

## 🎨 Recursos da Extensão Oficial

1. **Syntax Highlighting Completo**:
   - Destaque sintático fiel para todas as palavras-chave (`struct`, `enum`, `trait`, `impl`, `let mut`, `const`, `scope`, `spawn`, `catch`).
   - Diferenciação precisa entre tipos, interfaces, literais e operadores.

2. **Language Server Protocol (LSP)**:
   - **Diagnósticos em Tempo Real**: Erros de tipo, avisos de mutabilidade e violações de exaustividade de `match` sublinhados instantaneamente no editor conforme você digita.

3. **CodeLens Interativo**:
   - Botão **"Run"** acima de funções `main()` e rotas HTTP para executar o arquivo ou testar endpoints com um clique.

4. **Formatador Automático & Snippets**:
   - Indentação automática ao salvar (`Format on Save`).
   - Snippets inteligentes para criação de estruturas (`struct`, `enum`, `server.get`, `scope`, etc.).

---

## 📥 Instalando a Extensão Localmente

Para compilar e instalar a extensão no seu VSCode:

```bash
cd editors/vscode
npm install
npm run compile
```

No VSCode:
1. Abra a paleta de comandos (`Ctrl+Shift+P` ou `Cmd+Shift+P`).
2. Digite: `Extensions: Install from VSIX...` e selecione o pacote compilado.

---

## ⚙️ Configurações Recomendadas (`settings.json`)

Adicione as configurações abaixo ao seu arquivo de configuração do VSCode:

```json
{
  "[flex]": {
    "editor.defaultFormatter": "flexlang.flexlang-vscode",
    "editor.formatOnSave": true,
    "editor.tabSize": 4,
    "editor.insertSpaces": true
  }
}
```
