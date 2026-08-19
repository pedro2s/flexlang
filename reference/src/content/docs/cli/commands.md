---
title: Comandos da CLI (flex)
description: Referência completa de todos os subcomandos e flags da CLI oficial da FlexLang.
---

# Comandos da CLI (`flex`)

A ferramenta de linha de comando `flex` é a interface unificada para gerenciar todo o ciclo de vida de projetos FlexLang.

---

## 📋 Lista de Subcomandos

### 1. `flex init <nome>`
Cria um novo projeto FlexLang estruturado com `flex.toml`, `src/main.flex`, handler modular e suite de testes:

```bash
flex init meu-backend
```

---

### 2. `flex run [arquivo.flex]`
Executa o projeto em modo interpretado assíncrono (laboratório de desenvolvimento rápido). Se nenhum arquivo for especificado, utiliza o `entry` configurado em `flex.toml`:

```bash
flex run
# ou com arquivo explícito:
flex run src/main.flex
```

#### Flag `--watch` (ou `-w`)
Recarrega automaticamente a aplicação ao detectar qualquer alteração em arquivos `.flex` do grafo de dependências:

```bash
flex run --watch
```

---

### 3. `flex build [arquivo.flex]`
Transpila o código FlexLang para Go e compila um binário nativo altamente otimizado na pasta `build/`:

```bash
flex build
```

O binário final estará disponível em:
```bash
./build/main
```

---

### 4. `flex test [caminho]`
Descobre e executa todas as suítes de teste baseadas em arquivos golden `*_test.flex`:

```bash
flex test
# ou em pasta específica:
flex test tests/
```

---

### 5. `flex --help` e `flex --version`
Exibe o menu de ajuda e a versão instalada do compilador.
