// Teste 21: Teste negativo — o `?` propaga o erro como esta, entao o tipo do
// erro precisa caber no retorno de quem propaga.

func origem() -> Result<Int, String> {
    return Result.Err("falhou");
}

func destino() -> Result<Int, Int> {
    let x = origem()?; // propagaria um Err(String) para um Result<Int, Int>
    return Result.Ok(x);
}

destino();
