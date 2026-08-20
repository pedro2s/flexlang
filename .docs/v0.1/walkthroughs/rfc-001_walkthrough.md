# Walkthrough de Implementação: RFC-001 (Paridade Node↔Go no Transpiler)

## O que foi alterado
Este marco focou em eliminar a divergência onde o código FlexLang rodava perfeitamente no interpretador Node.js, mas falhava silenciosamente ou com stubs comentados (`// TODO: transpile stmt.kind`) durante o processo `flex build`.

As seguintes frentes foram transpiladas com sucesso para Go:
1. **Tipos Enumerados e Type Switches**: A AST `EnumDeclaration` foi transpilada para Go criando uma `interface{}` marcadora (e.g. `isMyEnum`) com structs separadas para cada variante do Enum. E o `MatchStmt` passou a gerar `switch v := target.(type)` em Go.
2. **TryExpr (`?`)**: Suporte massivo para a propagação de erros. Quando `expr?` é acionado no FlexLang, o Transpiler Go passa a destrinchar o tipo (`Result_Ok` e `Result_Err`), capturando o payload de erro e ejetando-o com `return`.
3. **Literais de Base**: Adição das expressões primitivas esquecidas: ArrayLiteral, IndexExpr, UnaryExpr, LogicalExpr e BooleanLiteral. 

## Reflexão Técnica
O desafio primário foi embutir a sintaxe idiomática da FlexLang no Go sem sacrificar tipagem e sem estourar o TypeChecker, provando que o fluxo imposto pelo **ADR-001** ("O mesmo programa produz o mesmo resultado nos dois modos") seria integralmente verdadeiro a partir desta RFC, já que os testes começaram a rodar nos dois ecossistemas ao mesmo tempo (Parity Gates).
