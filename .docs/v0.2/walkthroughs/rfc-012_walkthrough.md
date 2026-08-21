# Implementação da RFC-012: `flex run --watch` e Entrada de Projeto

Este walkthrough resume a implementação e validação da **RFC-012**, que adiciona o modo de observação (`--watch` / `-w`) ao comando `flex run` com suporte a recarga automática através de subprocessos isolados, além da resolução automática do ponto de entrada (`entry`) via `flex.toml`.

## 1. Resolução Automática de `entry` (`src/cli.ts`)

- **Resolução Sem Argumento**: `flex run` e `flex build` agora podem ser executados sem argumentos dentro de um diretório de projeto.
- **Ordem de Resolução (`resolveEntryPath`)**:
  1. Argumento de caminho explícito (ex: `flex run src/main.flex`).
  2. Campo `entry = "..."` no `flex.toml` do diretório atual ou ancestrais.
  3. Erro amigável caso nenhum seja encontrado.

## 2. Módulo Watcher (`src/watcher.ts`)

- **Observação do Grafo Inteiro**: O watcher inspeciona o `ModuleGraph` e cria observadores `fs.watch` nativos para cada arquivo alcançável a partir da entrada (não apenas o arquivo raiz).
- **Isolamento via Subprocesso**:
  - Cada execução roda em processo filho (`child_process.fork`), eliminando vazamentos de timers, portas HTTP (`EADDRINUSE`) e canais.
  - No reload, o processo anterior recebe `SIGTERM` (permitindo aos hooks de `on_shutdown` fechar conexões graciosamente) com timeout de 3s antes de `SIGKILL`.
- **Debounce e Resiliência**:
  - **Debounce de 80ms** e checagem de `mtimeMs` evitam reloads múltiplos em operações de salvamento de editores.
  - Erros de compilação/sintaxe durante o reload emitem o diagnóstico formatado e **não derrubam o watcher**, permitindo que o desenvolvedor corrija o código sem reiniciar o comando.
- **Atualização Dinâmica do Grafo**: A cada reload com sucesso, novos arquivos importados são automaticamente adicionados à lista de observação.

## 3. Resultados de Validação

- **`npm run test:watch`**: **8/8** testes de integração do watcher aprovados:
  - Resolução de `entry` no `flex.toml`
  - Erro de uso quando sem argumentos e sem `flex.toml`
  - Reload ao alterar arquivo de entrada
  - Reload ao alterar arquivo importado
  - Agrupamento de escritas rápidas pelo debounce
  - Recuperação após erro de compilação sem queda do watcher
  - Encerramento gracioso e liberação de porta HTTP
- **`npm test`**: 35/35 testes golden aprovados.
- **`npm run test:parity`**: 35/35 testes no parity gate.
- **`npm run test:http`**: 32/32 testes de integração HTTP.
- **`npx tsx tests/36_compiler_diagnostics.ts`**: 22/22 asserções aprovadas.
- **`npm run build`**: Build de produção gerado com sucesso sem avisos.
