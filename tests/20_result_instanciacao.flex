// Teste 20: Teste negativo — a instanciacao declarada e cobrada no retorno.
// Na construcao, `Result.Ok(x)` aceita qualquer x (T e livre); e aqui que o
// `Result<Int, String>` declarado cobra o tipo de verdade.

func f() -> Result<Int, String> {
    return Result.Ok("nao e um Int");
}

f();
