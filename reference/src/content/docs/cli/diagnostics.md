---
title: Guia de Diagnósticos de Erro
description: Catálogo completo dos códigos de erro estáticos do compilador FlexLang.
---

O compilador da FlexLang fornece mensagens de erro claras com indicação precisa de arquivo, linha, coluna e trecho de código sublinhado.

---

## 🗂️ Categorias de Erro

- **`E1xxx`**: Erros de Sintaxe, Lexer e Carregamento de Módulos
- **`E2xxx`**: Erros de Tipo, Exaustividade e Assinaturas
- **`E3xxx`**: Violações de Mutabilidade e Isolamento de Memória

---

## 📋 Catálogo de Códigos

| Código | Descrição | Exemplo de Causa |
|---|---|---|
| `E1001` | Erro Sintático no Parser | Token inesperado ou fechamento de bloco ausente |
| `E1005` | Dependência Circular Detectada | Módulo A importa Módulo B que importa Módulo A |
| `E2001` | Incompatibilidade de Tipos | Atribuição de `Int` em variável tipada como `String` |
| `E2010` | `match` Não Exaustivo | Esquecimento de variante de `enum` em bloco `match` |
| `E2012` | Aridade Incorreta de Função | Passagem de 3 argumentos para função que aceita 2 |
| `E2030` | Operador Módulo Inválido para Float | Uso de `%` em tipo `Float` |
| `E2034` | Expressão Dinâmica em `const` | Inicialização de constante com chamada de função |
| `E2035` | `catch` em Tipo Não-Result | Aplicação de bloco `catch` em expressão que não é `Result` |
| `E3001` | Mutação em Variável Imutável | Alteração de propriedade ou chamada de método mutante em `let` |
| `E3002` | Use-after-send de Variável Movida | Acesso a variável `mut` após ela ter sido enviada por canal |
| `E3003` | Reatribuição de Constante | Tentativa de sobrescrever valor de `const` |
