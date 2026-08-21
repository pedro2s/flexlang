---
title: Comandos da CLI (flex)
description: Referência completa de todos os subcomandos e flags da CLI oficial da FlexLang.
---

A ferramenta de linha de comando `flex` é a interface unificada para gerenciar todo o ciclo de vida de projetos FlexLang: inicialização, desenvolvimento com hot reload, testes unitários, checagem estática de tipos e compilação nativa para produção.

---

## 📋 Lista de Subcomandos

### 1. `flex init <nome>`
Cria um novo projeto FlexLang estruturado com `flex.toml`, `src/main.flex`, handlers e suíte de testes:

```bash
flex init meu-backend
```

---

### 2. `flex run [arquivo.flex]`
Executa o projeto no modo interpretado (feedback loop instantâneo). Se nenhum arquivo for especificado, utiliza o `entry` configurado em `flex.toml`:

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

### 3. `flex test [caminho] [flags]`
Descobre e executa suítes de testes unitários baseadas em arquivos `*_test.flex` usando o framework nativo `testing/unit`:

```bash
# Executa todos os testes do projeto
flex test

# Modo detalhado exibindo cada asserção executada
flex test --verbose (ou -v)

# Filtra testes por nome ou suíte describe
flex test --filter "Auth" (ou -f "Auth")

# Executa testes compilados nativamente em Go
flex test --native (ou -n)
```

---

### 4. `flex build [arquivo.flex]`
Transpila o código FlexLang para Go e compila um binário nativo altamente otimizado na pasta `build/`:

```bash
flex build
```

O binário final estará disponível em:
```bash
./build/main
```

---

### 5. `flex check [arquivo.flex]`
Executa apenas o TypeChecker estático em todo o grafo de módulos, validando tipos sem iniciar o servidor ou executar o programa:

```bash
flex check
```

---

### 6. `flex --help` e `flex --version`
Exibe o menu de ajuda e a versão instalada do compilador.
