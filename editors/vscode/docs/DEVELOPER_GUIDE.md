# Guia do Desenvolvedor: Extensão VSCode da FlexLang

Este guia descreve o fluxo de trabalho completo para desenvolvedores que desejam contribuir, testar localmente, depurar e publicar a extensão oficial da **FlexLang** para o Visual Studio Code.

---

## 1. Pré-requisitos

- **Node.js**: Versão 18 ou superior (recomendado Node 20+ ou 22 LTS).
- **npm** ou gerenciador de pacotes equivalente.
- **Visual Studio Code** instalado.

---

## 2. Estrutura de Diretórios

```
editors/vscode/
├── package.json                     # Manifesto da extensão e pontos de contribuição
├── language-configuration.json      # Regras de delimitadores, brackets e indentação
├── tsconfig.json                    # Configuração TypeScript do cliente e servidor
├── .vscodeignore                    # Arquivos ignorados no pacote .vsix
├── syntaxes/
│   └── flexlang.tmLanguage.json     # Gramática TextMate para syntax highlighting
├── snippets/
│   └── flexlang.json                # Catálogo de snippets para produtividade
├── src/
│   ├── client/
│   │   └── extension.ts             # Ponto de entrada do cliente VSCode
│   ├── server/
│   │   └── server.ts                # Servidor LSP (diagnósticos, completion, hover, etc.)
│   ├── formatter/
│   │   └── formatter.ts             # Motor de formatação automática (FlexFormatter)
│   └── codelens/
│       └── codelensProvider.ts      # Provedor de botões interativos (Run, Watch, Build)
├── docs/                            # Documentação técnica oficial (PRD, RFCs, Guia)
│   ├── PRD-VSCODE-TOOLING.md
│   ├── RFC-001-LSP-ARCHITECTURE.md
│   ├── RFC-002-SYNTAX-FORMATTER-SEMANTICS.md
│   ├── RFC-003-DIAGNOSTICS-QUICKFIX-ENGINE.md
│   └── DEVELOPER_GUIDE.md
└── tests/
    └── syntax.test.ts               # Suíte de testes automatizados da extensão
```

---

## 3. Executando os Testes Automatizados

A extensão possui uma suíte de validação abrangente que verifica a integridade dos arquivos JSON, o algoritmo do formatador de código e a integração de diagnósticos com o compilador:

```bash
# A partir da raiz do projeto flexlang:
npx tsx editors/vscode/tests/syntax.test.ts
```

---

## 4. Testando e Depurando Localmente no VSCode

Para testar a extensão em tempo real com o **Extension Development Host**:

1. Abra o diretório do projeto no VSCode:
   ```bash
   code /home/pedro/dev/pedro/flexlang
   ```
2. Abra o arquivo `editors/vscode/src/client/extension.ts`.
3. Pressione `F5` (ou vá em **Run and Debug** -> **Launch Extension**).
4. Uma nova janela do VSCode (*[Extension Development Host]*) será aberta com a extensão carregada.
5. Na nova janela, abra qualquer arquivo `.flex` (por exemplo, `examples/08_le_salvi_api/src/main.flex`).
6. Observe o realce de sintaxe colorido, os botões de CodeLens no topo do arquivo, os diagnósticos ao introduzir erros e a formatação com `Shift + Alt + F`.

---

## 5. Compilando e Empacotando o Pacote `.vsix`

Para gerar o arquivo de instalação offline (`.vsix`):

1. Instale o utilitário oficial `@vscode/vsce` globalmente ou execute via `npx`:
   ```bash
   npx @vscode/vsce package --cwd editors/vscode
   ```
2. O arquivo `vscode-flexlang-0.1.0.vsix` será gerado.
3. Para instalar no seu VSCode local:
   ```bash
   code --install-extension vscode-flexlang-0.1.0.vsix
   ```

---

## 6. Publicação no Visual Studio Code Marketplace e Open VSX

1. Crie uma conta de editor no [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Gere um Personal Access Token (PAT) no Azure DevOps.
3. Publique a extensão:
   ```bash
   npx @vscode/vsce publish --cwd editors/vscode -p <SEU_PERSONAL_ACCESS_TOKEN>
   ```
