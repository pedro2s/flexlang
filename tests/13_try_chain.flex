// Teste 13: Operador ? em cadeia (varios ? por funcao e ? aninhado em expressao)

enum Result {
    Ok(Int),
    Err(String)
}

func positivo(n: Int) -> Result {
    if n < 0 {
        return Result.Err("valor negativo");
    }
    return Result.Ok(n);
}

// Dois ? no mesmo corpo, e dois ? dentro de uma mesma expressao
func soma_validada(a: Int, b: Int) -> Result {
    let total = positivo(a)? + positivo(b)?;
    return Result.Ok(total);
}

// ? em cadeia: propaga o erro de uma funcao que ja propagou o erro de outra
func pipeline(a: Int, b: Int) -> Result {
    let parcial = soma_validada(a, b)?;
    let dobro = soma_validada(parcial, parcial)?;
    return Result.Ok(dobro);
}

func mostra(r: Result) -> Void {
    match r {
        Result.Ok(v) => {
            print("ok:");
            print(v);
        },
        Result.Err(e) => {
            print("erro:");
            print(e);
        }
    }
}

mostra(pipeline(2, 3));    // 2+3 = 5, 5+5 = 10
mostra(pipeline(2, -3));   // erro propagado do ? mais interno
mostra(pipeline(-1, 1));   // erro propagado no primeiro ? da cadeia
