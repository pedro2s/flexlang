<div align="center">
  <img src="https://raw.githubusercontent.com/pedro2s/flexlang/main/assets/octans-logo.svg" alt="FlexLang" width="96" height="96" />
  <h1>FlexLang para Visual Studio Code</h1>
  <p><strong>A extensão oficial de desenvolvimento produtivo, dinâmico e inteligente para a linguagem FlexLang (v0.4.0).</strong></p>
</div>

---

## ⚡ Recursos Principais

- 🎨 **Realce Sintático Completo (TextMate Grammar):** Destaque avançado para palavras-chave (`func`, `struct`, `impl`, `enum`, `match`, `scope`, `spawn`, `catch`), atributos/anotações (`#[test]`, `#[derive]`), modificadores de mutabilidade (`let`, `mut`, `const`), interpolação de strings `${...}`, tipos da Standard Library e operadores especiais (`->`, `=>`, `?`, `..`).
- 🧠 **Language Server Protocol (LSP) Integrado:**
  - **Diagnósticos em Tempo Real:** Verificação léxica, sintática e semântica de tipos com mensagens explicativas (`E1xxx` a `E5xxx`) e sugestões de correção acionáveis.
  - **IntelliSense & Auto-complete:** Sugestões inteligentes para todos os módulos da Stdlib (`net/http`, `storage/redis`, `data/validator`, `core/resilience`, `mq/kafka`, `std/testing`, `std/fs`, etc.), palavras-chave, tipos e asserções.
  - **Documentação em Hover:** Documentação interativa em Markdown para toda a Standard Library v0.4.0, funções locais e estruturas.
  - **Go to Definition:** Navegação rápida para definições locais e módulos importados (`import { ... } from "./modulo"`).
  - **Símbolos e Outline:** Navegação hierárquica por funções, testes, constantes, estruturas, enums e traits no Outline e breadcrumbs.
  - **Signature Help:** Guia interativo de parâmetros durante chamadas de função.
- 📐 **Formatador Automático de Código (Auto-Format):** Formatação determinística respeitando indentação, alinhamento de chaves, atributos `#[test]`, blocos `catch` e operadores.
- 🚀 **Snippets de Alta Produtividade:** Blocos prontos para testes unitários com `#[test]` e `std/testing`, servidores REST, clientes HTTP, Redis com distributed locks, validações com `Validator`, Circuit Breakers, telemetria e Kafka.
- 🕹️ **CodeLens Interativo & Comandos Rápidos:**
  - `▶ Executar (flex run)` diretamente acima da função `main()`.
  - `⚡ Watch Mode (flex run --watch)` para desenvolvimento com hot reload.
  - `📦 Compilar Go (flex build)` para gerar binários nativos de alta performance.
  - `🛡️ Checar Tipos (flex check)` para validação estática instantânea.
  - `🧪 Executar Teste (flex test)` diretamente acima de funções `#[test]`.
  - `⚡ Teste Nativo (flex test --native)` para validar a paridade de execução compilada em Go.

---

## 🚀 Como Usar

1. Abra qualquer arquivo com extensão `.flex` no VSCode.
2. A extensão será ativada automaticamente e o servidor de linguagem iniciará a análise em tempo real.
3. Utilize o atalho padrão de formatação (`Shift + Alt + F` no Linux/Windows ou `Shift + Option + F` no macOS) para formatar seu código.
4. Execute o arquivo ou seus testes diretamente pelos botões de **CodeLens** ou pelo Command Palette (`Ctrl+Shift+P`).

---

## ⚙️ Configurações Disponíveis

| Configuração | Padrão | Descrição |
|---|---|---|
| `flexlang.cliPath` | `"flex"` | Caminho para o executável da CLI FlexLang. |
| `flexlang.format.enable` | `true` | Habilita a formatação automática de código. |
| `flexlang.format.indentSize` | `4` | Quantidade de espaços por nível de indentação. |
| `flexlang.diagnostics.onType` | `true` | Habilita análise e diagnósticos em tempo real durante a digitação. |
| `flexlang.codeLens.enable` | `true` | Exibe botões interativos de CodeLens sobre pontos de entrada e testes. |

---

## 📚 Documentação Técnica

Para especificações detalhadas sobre a arquitetura do LSP, formatador e diagnósticos, consulte o diretório [docs/](./docs/):
- [PRD - Requisitos de Produto e Ferramentas](./docs/PRD-VSCODE-TOOLING.md)
- [RFC-001 - Arquitetura do Language Server Protocol](./docs/RFC-001-LSP-ARCHITECTURE.md)
- [RFC-002 - Gramática de Sintaxe, Semântica e Formatador](./docs/RFC-002-SYNTAX-FORMATTER-SEMANTICS.md)
- [RFC-003 - Motor de Diagnósticos e Quick Fixes](./docs/RFC-003-DIAGNOSTICS-QUICKFIX-ENGINE.md)
- [Guia do Desenvolvedor & Contribuição](./docs/DEVELOPER_GUIDE.md)
