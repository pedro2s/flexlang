---
title: Manifesto flex.toml
description: Especificação de todos os campos e opções de configuração do arquivo flex.toml.
---

O arquivo `flex.toml` é o manifesto declarativo obrigatório de todo projeto FlexLang.

---

## 📄 Exemplo Completo

```toml
[package]
name = "minha-api-bancaria"
version = "1.0.0"
entry = "src/main.flex"
flex_version = "0.3.0"
description = "Microserviço de liquidação financeira de alta performance"
```

---

## 🏷️ Campos Suportados

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | `String` | **Sim** | Identificador único do projeto/pacote. |
| `version` | `String` | **Sim** | Versão SemVer atual (ex: `"0.1.0"`, `"1.0.0"`). |
| `entry` | `String` | **Sim** | Caminho relativo para o arquivo de entrada principal (ex: `"src/main.flex"`). |
| `flex_version` | `String` | **Sim** | Versão mínima do compilador FlexLang suportada. Se o usuário tentar rodar com versão inferior, o compilador aborta com instrução clara. |
| `description` | `String` | Não | Breve descrição da finalidade do serviço. |
