// Teste 03: Type Checker Básico e Inferência Local

func sum(a: Int, b: Int) -> Int {
    return a + b;
}

// A inferência deduzirá que 'x' e 'y' são Int.
let x = 10;
let y = 20;

// Tipagem explícita com o tipo correto e CallExpr.
let result: Int = sum(x, y);

// ISSO DEVE FALHAR EM TEMPO DE COMPILAÇÃO!
// O script vai interromper antes mesmo de qualquer "print" executar, 
// pois o TypeChecker detectará que `sum` retorna `Int`, mas a variável exige `String`.
let bad: String = sum(5, 5);
