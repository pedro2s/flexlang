# Implementação da RFC-007: CLI Toolchain v1

Este walkthrough resume as melhorias aplicadas na CLI da FlexLang (`src/cli.ts`) para oferecer uma experiência completa e robusta de desenvolvimento, englobando a inicialização de projetos, baterias de testes e hardening de compilação.

## Changes Made

### 1. `flex init` com Arquitetura Hexagonal Pragmática
A estrutura padrão para novos projetos gerados pela CLI agora reflete boas práticas de arquitetura. O scaffolding não gera apenas um amontoado de pastas, mas uma estrutura dividida em "Bounded Contexts".
- `flex.toml`: Inicializado apontando para `src/main.flex`.
- `src/main.flex`: Composition Root que inicializa a aplicação.
- `src/modules/`: Onde residem os Bounded Contexts (ex: `health` scaffoldado por padrão).
- `src/shared/`: Onde ficam lógicas de conectividade e preocupações cross-cutting.
- `tests/`: Estrutura de teste funcional e pronta para uso.

> [!TIP]
> No scaffolding gerado, é incluída uma chamada explícita para `main();` no nível raiz dos arquivos principais (`main.flex` e `health_test.flex`). Isso garante que o corpo do programa seja executado tanto no modo interpretado local, quanto incorporado como a `func main()` nativa do Go compilado.

### 2. `flex test` de Primeira Classe
Testes do projeto agora podem ser rodados nativamente via `flex test` sem depender de chamadas manuais para runners.
- Quando invocado sem argumentos (ex: `flex test`), varre iterativamente a raiz atual procurando por arquivos `*_test.flex`.
- Executa de forma integrada contra `TypeChecker` e `Interpreter`, capturando `stdout` perfeitamente.
- Incorpora validação Golden-File (`.out`) integrada ao fluxo de CI/CD, retornando `exit 1` no caso de qualquer divergência ou erro de interpretação.
- O runner interno oficial (`tests/runner.ts`) da linguagem continua funcional focado apenas nos testes do próprio compilador/interpretador para evitar quebrar cenários complexos (como injeções do `echoModule`).

### 3. Hardening de Compilação (`flex build`)
Agora, ao utilizar `flex build`, o desenvolvedor recebe mensagens coerentes caso ocorra algum problema no "under the hood" de sua compilação.
- Caso o compilador do Go (`go build`) não esteja instalado no `$PATH`, uma mensagem educada de recomendação será exibida ao usuário ("Go compiler not found. Do you have Go installed?").
- Caso ocorra um erro de sintaxe durante a transpilação, o `stderr` gerado pelo processo do Go será completamente propagado no terminal e exibido de forma nítida, alertando que pode se tratar de um possível problema no *Transpiler* da FlexLang (o que não deve ocorrer em um código formalmente aceito pelo checker).
- Retorno pragmático de exit codes `1` e delegação correta via `child_process.execSync` no terminal.
- O resultado do `build` e transpilação para Go passa a ser depositado isoladamente em um diretório `build/`, despoluindo a estrutura raiz do desenvolvedor.

## Validation Results

A CLI foi fortemente testada com cenários reais de ponta a ponta:
- Criação de novos projetos isolados (ex: `flex init my_app`).
- Execução isolada dos testes do novo projeto gerado (`flex test` retornando `exit 0` com os golden files corretos).
- Compilação dos novos projetos passando com Go puro (`flex build src/main.flex`).
- Todos os testes unitários fundamentais do Typescript em `npm test` passaram sem regressões, validando a integridade das modificações.
