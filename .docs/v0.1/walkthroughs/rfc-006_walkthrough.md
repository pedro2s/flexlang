# Revisão da RFC-006: Sistema de Módulos Locais (Multi-arquivo)

Implementação do sistema de módulos locais multi-arquivo para a FlexLang com resolução de grafo de dependências, detecção de ciclos de import, escopo estático por arquivo no TypeChecker, execução topológica no interpretador e transpilação em arquivo Go único compilável com paridade total.

## O Que Foi Construído?

### 1. Carregamento e Grafo de Dependências (`src/loader.ts`)
- Estruturas `SourceFile` e `ModuleGraph` para indexação de nós e arestas de dependência.
- Resolução de caminhos locais com `resolveModuleFilePath`, aceitando `./`, `../` e caminhos absolutos, com ou sem extensão `.flex`.
- Detecção de ciclos de import durante DFS (`visiting`), reportando `CompileError: circular import between 'a.flex' and 'b.flex'`.
- Ordenação topológica (folhas primeiro, entrada principal por último).

### 2. Verificação Estática de Tipos (`src/checker.ts`)
- Suporte a `ModuleGraph` mantendo retrocompatibilidade com `Stmt[]`.
- **Pass 1 (Hoisting Global e Resolução de Imports)**:
  - Registro de declarações top-level por arquivo.
  - Validação estrita de símbolos requisitados via destructuring `import { X, Y } from "./mod"`, acusando `ImportError: Symbol 'X' not found in module '...'`.
  - Construção de tabelas de símbolos visíveis restritas por arquivo.
- **Pass 2 (Checagem Profunda)**:
  - Checagem por arquivo com escopo isolado na ordem topológica.
  - Avaliação recursiva de sub-expressões em `StringInterpolationExpr` para anotação precisa de membros no `TypeMap`.

### 3. Interpretador (`src/interpreter.ts`)
- Execução na ordem topológica sobre o ambiente compartilhado `globalEnv`.
- Módulos dependentes têm suas funções e estruturas registradas antes do arquivo principal executar.

### 4. Transpiler Go (`src/transpiler.ts`)
- Detecção de colisão de nomes de símbolos globais entre módulos (`CompileError: Duplicate symbol '...' declared across modules`).
- Agrupamento de declarações de todos os arquivos no mesmo arquivo `.go` (`package main`), filtrando imports locais e emitindo o fluxo topológico em `func main()`.

### 5. CLI (`src/cli.ts`)
- Comandos `flex run` e `flex build` integrados ao `loadModuleGraph`.

## Validação e Testes

- **Projeto Multi-arquivo com 3 Arquivos**:
  - `tests/modules/user.flex`: Modelo `User` e método `greeting()`.
  - `tests/modules/user_repo.flex`: Repositório que importa `User` e implementa `find_user(id) -> Result<User, String>`.
  - `tests/27_local_modules.flex`: Ponto de entrada com matching de `Result.Ok` e `Result.Err`.
- **Testes de Erros (`tests/28_module_errors.ts`)**:
  - Ciclos de importação (`CompileError`).
  - Módulos inexistentes (`ImportError`).
  - Símbolos não exportados (`ImportError`).
  - Colisão de símbolos no transpiler (`CompileError`).
- **Parity Gate**:
  - `tests/27_local_modules.flex` validado com paridade exata de saída entre Node.js interpretado e binário nativo Go compilado.
