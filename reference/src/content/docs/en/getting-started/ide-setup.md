---
title: VSCode Setup & Tooling
description: Setup the official FlexLang VSCode extension with LSP, syntax highlighting, and CodeLens.
---

FlexLang provides official first-class support for **Visual Studio Code** via the built-in extension in `editors/vscode`.

---

## 🎨 Official Extension Features

1. **Rich Syntax Highlighting**:
   - Comprehensive TextMate grammar covering all keywords (`struct`, `enum`, `trait`, `impl`, `let mut`, `const`, `scope`, `spawn`, `catch`).
   - Distinct semantic coloring for types, structs, methods, literals, and operators.

2. **Language Server Protocol (LSP)**:
   - **Real-Time Diagnostics**: Type mismatches, mutability errors, and pattern matching exhaustiveness warnings underlined live as you type.

3. **Interactive CodeLens**:
   - One-click **"Run"** buttons displayed above `main()` entrypoints and HTTP route definitions.

4. **Code Formatter & Snippets**:
   - Automatic indentation on save (`Format on Save`).
   - Productivity snippets for structs, enums, server routes, channels, and scopes.

---

## 📥 Installing the Extension Locally

To compile and load the extension into VSCode:

```bash
cd editors/vscode
npm install
npm run compile
```

Inside VSCode:
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run `Extensions: Install from VSIX...` and select the packaged artifact.

---

## ⚙️ Recommended Settings (`settings.json`)

Add the following to your user or workspace `settings.json`:

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
