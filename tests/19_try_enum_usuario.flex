// Teste 19: Teste negativo — o `?` nao aceita mais qualquer enum cuja primeira
// variante por acaso se chame `Ok`. Propagacao e semantica de Result/Option,
// nao de nome de variante.

enum MeuTipo {
    Ok(Int),
    Falha(String)
}

func produz() -> MeuTipo {
    return MeuTipo.Ok(1);
}

func consome() -> MeuTipo {
    let x = produz()?;
    return MeuTipo.Ok(x);
}

consome();
