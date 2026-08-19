---
title: Seu Primeiro Projeto em 5 Minutos
description: Crie, teste, execute e compile seu primeiro serviço FlexLang.
---

Neste guia, você criará um novo projeto FlexLang, entenderá a estrutura gerada, executará testes e compilará um binário nativo.

---

## 1. Criando o Projeto com `flex init`

Execute o comando `flex init` informando o nome do seu projeto:

```bash
flex init meu-primeiro-app
cd meu-primeiro-app
```

A CLI criará uma estrutura de projeto pronta e organizada:

```text
meu-primeiro-app/
├── flex.toml                # Manifesto do projeto e versão da FlexLang
├── src/
│   ├── main.flex            # Ponto de entrada principal
│   ├── modules/
│   │   └── health/
│   │       └── handler.flex # Módulo com handler de exemplo
│   └── shared/
└── tests/
    ├── health_test.flex     # Arquivo de teste golden
    └── health_test.out      # Saída esperada do teste
```

---

## 2. O Manifesto `flex.toml`

Abra o arquivo `flex.toml`:

```toml
[package]
name = "meu-primeiro-app"
version = "0.1.0"
entry = "src/main.flex"
flex_version = "0.3.0"
```

O campo `entry` define o arquivo principal a ser executado quando você chama `flex run` sem argumentos. O campo `flex_version` garante compatibilidade mínima do compilador.

---

## 3. Executando em Modo Desenvolvimento (`flex run`)

Execute o projeto localmente:

```bash
flex run
```

Saída:
```text
[flex] Running /caminho/meu-primeiro-app/src/main.flex in interpreted mode...

Starting meu-primeiro-app...
Health: OK
```

### Modo Watch com Recarregamento Automático
Durante o desenvolvimento, use a flag `--watch` (ou `-w`) para recarregar automaticamente sempre que qualquer arquivo do projeto for alterado:

```bash
flex run --watch
```

---

## 4. Executando os Testes Automatizados (`flex test`)

A FlexLang possui um test runner nativo baseado em *Golden File Testing*:

```bash
flex test
```

Saída:
```text
Running 1 test(s)...

[PASS] health_test.flex

Tests Completed: 1 passed, 0 failed.
```

---

## 5. Compilando o Binário Nativo de Produção (`flex build`)

Para gerar o executável nativo compilado:

```bash
flex build
```

O compilador transpilou seu código para Go e gerou o executável na pasta `build/`:

```bash
./build/main
```

Parabéns! Você construiu, testou e compilou seu primeiro serviço com a FlexLang.
