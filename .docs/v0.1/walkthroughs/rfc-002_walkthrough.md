# Walkthrough de Implementação: RFC-002 (Stdlib Built-ins `Result` e `Option`)

## O que foi alterado
Os tipos de base para manipulação de erros e valores ausentes foram formalmente embutidos na infraestrutura núcleo da linguagem, unificando a forma como os desenvolvedores constroem arquiteturas resilientes e como os *Módulos Nativos* se expressam.

- **`src/stdlib.ts`**: Definimos a estrutura dos enums Builtin e instanciamos classes JS (como `EnumVariantValue`) para contornar problemas de declaração em módulos nativos de TypeScript sem precisarmos usar classes da AST no *Interpreter*.
- **Transpiler Golang**: Estabeleceu-se uma representação genérica em runtime para os Builtins Go. A fim de permitir o desempacotamento sem perder a identidade e permitir o uso do `TryExpr (?)` corretamente, a infraestrutura base gera `Result` e `Option` com `any` nos tipos literais injetados no boilerplate, abrindo espaço para Type Casting dinâmico.

## Reflexão Técnica
Embora a inferência genérica da FlexLang ainda seja básica, formalizar `Result` e `Option` nativamente retirou o fardo do usuário precisar reimplementar esses Enums em cada arquivo de projeto e garantiu que todas as bibliotecas da *Standard Library* pudessem compartilhar interfaces padronizadas para falhas.
