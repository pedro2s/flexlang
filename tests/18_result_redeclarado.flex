// Teste 18: Teste negativo — Result e um tipo embutido e nao pode ser
// redeclarado. O erro precisa dizer isso, e nao um erro generico de tipo.

enum Result {
    Ok(Int),
    Err(String)
}

let r = Result.Ok(1);
print(r);
