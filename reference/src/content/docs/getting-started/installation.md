---
title: Instalação em 60 Segundos
description: Instale o compilador e CLI da FlexLang em seu ambiente.
---

# Instalação da FlexLang

A CLI unificada `flex` fornece todo o ferramental necessário: compilador, interpretador, executor de testes e integração com Go.

---

## ⚡ Pré-requisitos

1. **Node.js**: Versão 18 ou superior (recomendado Node 20+ ou 22 LTS).
2. **Go (Opcional, para `flex build`)**: Versão 1.22+ caso queira compilar binários nativos com `flex build`. Para modo interpretado com `flex run`, o Node.js é suficiente.

---

## 📦 Instalação via Gerenciador de Pacotes

Instale a CLI globalmente através do seu gerenciador favorito:

### npm (Padrão)
```bash
npm install -g @flexlang/cli
```

### pnpm
```bash
pnpm add -g @flexlang/cli
```

### yarn
```bash
yarn global add @flexlang/cli
```

### bun
```bash
bun add -g @flexlang/cli
```

---

## ✅ Verificando a Instalação

Após a instalação, verifique se o comando `flex` está disponível no seu terminal:

```bash
flex --help
```

Você verá a saída do menu de ajuda:

```text
🚀 FlexLang CLI

Usage:
  flex init <name>               - Creates a new FlexLang project
  flex run [file.flex]           - Interprets and runs the file (or entry from flex.toml)
  flex run --watch [file.flex]   - Runs in watch mode, reloading on any file changes
  flex build [file.flex]         - Transpiles to Go and compiles to a native binary
  flex test [path]               - Runs golden file tests (matches *_test.flex)
```

---

## 🔄 Atualizando para a Versão Mais Recente

Para atualizar sua instalação para a última versão estável:

```bash
npm install -g @flexlang/cli@latest
```
