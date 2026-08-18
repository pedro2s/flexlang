# PRD: Ferramentas VSCode e Experiência do Desenvolvedor (DX) para FlexLang

| Metadado | Detalhe |
|---|---|
| **Produto** | FlexLang VSCode Extension & Developer Tooling |
| **Versão** | 1.0.0 |
| **Status** | Aprovado para Implementação |
| **Autor** | Pedro Santana / Time de Ferramentas FlexLang |
| **Data** | Agosto/2026 |

---

## 1. Sumário Executivo & Visão do Produto

A **FlexLang** é uma linguagem moderna projetada para backends escaláveis, seguros e de altíssimo desempenho, combinando concorrência estruturada nativa, tipagem forte com eliminação estática de *data races* e compilação nativa para Go.

Para que a adoção da linguagem seja rápida e fluida entre desenvolvedores de software, a experiência no editor (Developer Experience - DX) precisa ser **imediata, rica e interativa**. Este PRD define o escopo, requisitos e especificações da extensão oficial da FlexLang para o **Visual Studio Code**, transformando o editor em um ambiente de desenvolvimento integrado (IDE) de primeira classe.

### Visão de DX:
> "Escrever FlexLang no VSCode deve ser tão responsivo quanto escrever TypeScript, tão seguro e explicativo quanto Rust (com diagnósticos visuais claros) e tão simples e direto quanto Go."

---

## 2. Personas e Casos de Uso

### Persona 1: Desenvolvedor Backend / Microsserviços
- **Necessidade**: Construir APIs REST com `net/http` e interações com banco PostgreSQL (`db/postgres`) com rapidez.
- **Dores**: Perder tempo decorando estruturas de configuração ou descobrindo erros de sintaxe apenas ao rodar o compilador na linha de comando.
- **Solução**: Snippets inteligentes para boilerplate de servidores/rotas, IntelliSense para métodos da stdlib e diagnósticos de tipos em tempo real enquanto digita.

### Persona 2: Engenheiro de Sistemas Paralelos e Distribuídos
- **Necessidade**: Implementar pipelines concorrentes utilizando `scope`, `spawn` e `Channel`.
- **Dores**: Erros sutis de mutabilidade concorrente ou *use-after-send*.
- **Solução**: O compilador e o Language Server apontam exatamente a linha e coluna onde uma variável mutável foi movida (`E3001`), com dicas visuais de correção imediata.

---

## 3. Matriz de Requisitos e Priorização

### P0 (Crítico / Obrigatório para v1.0)
- **Gramática de Sintaxe (TextMate)**: Destaque de código com suporte completo a palavras-chave, tipos, mutabilidade, concorrência, operadores e interpolação de strings.
- **Language Server Protocol (LSP)**:
  - Verificação de diagnósticos em tempo real (Léxico, Sintático e Semântico de Tipos com mensagens explicativas).
  - IntelliSense / Auto-complete para palavras-chave, tipos primitivos, módulos stdlib e símbolos locais.
  - Hover interativo exibindo assinaturas e documentação contextual.
  - Símbolos de documento para navegação hierárquica no Outline e Breadcrumbs.
  - Go to Definition para navegação de código em arquivos locais e módulos importados.
- **Formatador Automático (Auto-Format)**: Formatação determinística com indentação consistente e normalização de operadores.
- **Catálogo de Snippets**: Modelos de código para APIs HTTP, PostgreSQL, concorrência, structs e pattern matching.
- **Comandos de Execução e Status Bar**: Execução de `flex run`, `flex run --watch`, `flex build` e `flex test` via atalhos e botões no editor.

### P1 (Importante / Produtividade Avançada)
- **CodeLens Interativo**: Botões `▶ Executar (flex run)` e `⚡ Watch Mode` sobre a função `main()` e testes `*_test.flex`.
- **Signature Help**: Dicas de parâmetros ativos durante a digitação de chamadas de métodos e funções.
- **Code Actions / Quick Fixes**: Sugestões automáticas para correção de erros comuns (ex: adicionar `mut` em variável reatribuída).

### P2 (Evolução Futura)
- **Depuração Integrada (DAP - Debug Adapter Protocol)**.
- **Renomeação de Símbolos em múltiplos arquivos (Rename Provider)**.
- **Inlay Hints para tipos inferidos de variáveis**.

---

## 4. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Visual Studio Code                       │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   TextMate Grammar    │       │  Commands & CodeLens  │  │
│  │  (Syntax Highlight)  │       │  (Run, Watch, Build)  │  │
│  └───────────────────────┘       └───────────┬───────────┘  │
│              │                               │              │
│  ┌───────────▼───────────┐       ┌───────────▼───────────┐  │
│  │    VSCode LSP Client  │◄─────►│    Terminal Bridge    │  │
│  └───────────┬───────────┘       └───────────────────────┘  │
└──────────────┼──────────────────────────────────────────────┘
               │ JSON-RPC (IPC / Stdio)
┌──────────────▼──────────────────────────────────────────────┐
│             FlexLang Language Server (LSP)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Document Sync Manager & AST Cache                     │  │
│  └───────┬──────────────┬───────────────┬────────────────┘  │
│          │              │               │                   │
│  ┌───────▼──────┐ ┌─────▼───────┐ ┌─────▼───────┐           │
│  │ FlexCompiler │ │   Formatter │ │ IntelliSense│           │
│  │ Parser/Check │ │  Engine     │ │ & Hover Doc │           │
│  └──────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Requisitos Não Funcionais (NFR)

1. **Latência de Diagnóstico**: Diagnósticos semânticos devem ser publicados em menos de 50ms para arquivos de até 2.000 linhas.
2. **Uso de Memória**: O Language Server não deve exceder 80MB de RAM durante o desenvolvimento regular.
3. **Resiliência a Código Incompleto**: O parser e o analisador devem se recuperar com elegância de trechos de código incompletos sem quebrar o processo do servidor.
4. **Isolamento de Erros**: Erros no Language Server nunca devem travar ou congelar a interface do VSCode.

---

## 6. Métricas de Sucesso & Critérios de Aceite

| Métrica | Meta |
|---|---|
| **Tempo de Onboarding** | Um desenvolvedor novo é capaz de criar e rodar uma API REST em FlexLang em menos de 2 minutos utilizando snippets e CodeLens. |
| **Acurácia de Sintaxe** | 100% dos exemplos oficiais da FlexLang (`examples/`) com destaque de sintaxe correto. |
| **Taxa de Crash do LSP** | Zero travamentos ou desconexões inesperadas em sessões de desenvolvimento contínuas. |
