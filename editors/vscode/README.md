<div align="center">
  <img src="https://raw.githubusercontent.com/pedro2s/flexlang/main/assets/octans-logo.svg" alt="FlexLang" width="96" height="96" />
  <h1>FlexLang para Visual Studio Code</h1>
  <p><strong>A extensão oficial de desenvolvimento produtivo, dinâmico e inteligente para a linguagem FlexLang.</strong></p>
</div>

---

## ⚡ Recursos Principais

- 🎨 **Realce Sintático Completo (TextMate Grammar):** Destaque de palavras-chave (`func`, `struct`, `impl`, `enum`, `match`, `scope`, `spawn`), modificadores de mutabilidade (`let`, `mut`, `const`), interpolação de strings `${...}`, comentários JSDoc/Doc e operadores especiais (`->`, `=>`, `?`, `..`).
- 🧠 **Language Server Protocol (LSP) Integrado:**
  - **Diagnósticos em Tempo Real:** Verificação léxica, sintática e semântica de tipos com mensagens explicativas (`E1xxx` a `E5xxx`) e sugestões de correção acionáveis.
  - **IntelliSense & Auto-complete:** Sugestões inteligentes de tipos, módulos da stdlib (`net/http`, `db/postgres`, `core/log`), métodos e palavras-chave.
  - **Documentação em Hover:** Dicas dinâmicas com assinaturas de funções, tipos de structs e documentação da biblioteca padrão.
  - **Go to Definition:** Navegação rápida para definições locais e arquivos importados (`import { ... } from "./modulo"`).
  - **Símbolos e Outline:** Navegação hierárquica por funções, estruturas, enums e traits no Outline do editor e breadcrumbs.
  - **Signature Help:** Guia de parâmetros durante a digitação de chamadas de funções.
- 📐 **Formatador Automático de Código (Auto-Format):** Formatação determinística respeitando indentação, alinhamento de chaves, espaçamento de operadores e blocos de pattern matching.
- 🚀 **Snippets de Alta Produtividade:** Blocos prontos para servidores HTTP REST, conexão PostgreSQL com queries parametrizadas `$1`, concorrência com `scope`/`spawn` e tratamento com `Result<T, E>` / `?`.
- 🕹️ **CodeLens Interativo & Comandos Rápidos:**
  - `▶ Executar (flex run)` diretamente acima da função `main()`.
  - `⚡ Watch Mode (flex run --watch)` para desenvolvimento com hot reload.
  - `📦 Compilar Go (flex build)` para gerar binários nativos.
  - `🧪 Executar Testes (flex test)` para rodar a suíte de testes do projeto.

---

## 🚀 Como Usar

1. Abra qualquer arquivo com extensão `.flex` no VSCode.
2. A extensão será ativada automaticamente e o servidor de linguagem iniciará a análise.
3. Utilize o atalho padrão de formatação (`Shift + Alt + F` no Windows/Linux ou `Shift + Option + F` no macOS) para formatar seu código.
4. Execute o arquivo clicando no CodeLens **"▶ Executar (flex run)"** ou através do Command Palette (`Ctrl+Shift+P` -> `FlexLang: Executar Arquivo Atual`).

---

## ⚙️ Configurações Disponíveis

| Configuração | Padrão | Descrição |
|---|---|---|
| `flexlang.cliPath` | `"flex"` | Caminho para o executável da CLI FlexLang. |
| `flexlang.format.enable` | `true` | Habilita a formatação automática de código. |
| `flexlang.format.indentSize` | `4` | Quantidade de espaços por nível de indentação. |
| `flexlang.diagnostics.onType` | `true` | Habilita análise e diagnósticos em tempo real durante a digitação. |
| `flexlang.codeLens.enable` | `true` | Exibe botões interativos de CodeLens sobre pontos de entrada. |

---

## 📚 Documentação Técnica

Para especificações detalhadas sobre a arquitetura do LSP, formatador e diagnósticos, consulte o diretório [docs/](./docs/):
- [PRD - Requisitos de Produto e Ferramentas](./docs/PRD-VSCODE-TOOLING.md)
- [RFC-001 - Arquitetura do Language Server Protocol](./docs/RFC-001-LSP-ARCHITECTURE.md)
- [RFC-002 - Gramática de Sintaxe, Semântica e Formatador](./docs/RFC-002-SYNTAX-FORMATTER-SEMANTICS.md)
- [RFC-003 - Motor de Diagnósticos e Quick Fixes](./docs/RFC-003-DIAGNOSTICS-QUICKFIX-ENGINE.md)
- [Guia do Desenvolvedor & Contribuição](./docs/DEVELOPER_GUIDE.md)
