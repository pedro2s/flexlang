---
title: 9. Módulos Locais e flex.toml
description: Como organizar projetos em múltiplos arquivos, importar código local e configurar o flex.toml.
---

# Módulos Locais e `flex.toml`

Projetos FlexLang reais são organizados em múltiplos arquivos e pastas com importações limpas e resolução estática de dependências.

---

## 📁 Importando Módulos Locais

Use caminhos relativos com `./` ou `../` para importar structs, funções, enums e constantes de outros arquivos `.flex`:

```flexlang
// src/services/user_service.flex
import { User } from "../models/user";
import { find_by_id } from "../repository/user_repository";

func buscar_dados(id: Int) -> User {
    return find_by_id(id);
}
```

---

## 🔍 Detecção de Dependências Circulares

O **Loader** do compilador constrói o grafo estático de dependências e impede ciclos de importação (`A -> B -> A`). Caso um ciclo seja detectado, o compilador avisa com o erro `E1005` indicando a cadeia exata do ciclo.

---

## 📄 O Arquivo de Configuração `flex.toml`

O arquivo `flex.toml` fica na raiz do projeto:

```toml
[package]
name = "meu-servico"
version = "0.1.0"
entry = "src/main.flex"
flex_version = "0.3.0"
```

- `name`: Nome do pacote.
- `version`: Versão SemVer do projeto.
- `entry`: Ponto de entrada padrão para `flex run` e `flex build`.
- `flex_version`: Versão mínima exigida do compilador FlexLang.
