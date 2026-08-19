---
title: 7. Tratamento de Erros Moderno
description: Result, Option, operador de propagação ?, e expressões catch inline.
---

A FlexLang rejeita exceções implícitas (`throw/try/catch` tradicional) que ocultam fluxos de controle e quebram a previsibilidade. Erros na FlexLang são **valores explícitos**.

---

## 🎁 `Result<T, E>` e `Option<T>`

A biblioteca padrão injeta dois tipos genéricos fundamentais:

```flexlang
enum Result<T, E> {
    Ok(T),
    Err(E)
}

enum Option<T> {
    Some(T),
    None
}
```

Exemplo de função que retorna `Result`:

```flexlang
func dividir(a: Int, b: Int) -> Result<Int, String> {
    if b == 0 {
        return Result.Err("Divisão por zero não permitida");
    }
    return Result.Ok(a / b);
}
```

---

## ❓ O Operador de Propagação (`?`)

O operador `?` extrai o valor de `Result.Ok(v)` ou `Option.Some(v)`. Se a expressão for `Err(e)` ou `None`, ela **retorna imediatamente** da função corrente:

```flexlang
func calcular_fatura(user_id: String) -> Result<Float, String> {
    let user = buscar_usuario(user_id)?; // Se falhar, retorna o Err imediatamente
    let contrato = buscar_contrato(user.id)?;
    let taxa = calcular_taxa(contrato)?;

    return Result.Ok(taxa);
}
```

---

## 🛡️ Blocos `catch` com Fallback Inline

Quando você quer interceptar um `Result.Err` diretamente no ponto de chamada para aplicar um valor padrão, logar ou executar um fallback sem a verbosidade de um `match`:

```flexlang
// Desembrulha o Result se for Ok; executa o bloco e usa o retorno se for Err
let config = ler_config_arquivo("config.json") catch err {
    log.warn("Falha ao ler config.json, usando padrão", { erro: err });
    gerar_config_padrao()
};
```

Com o operador `?` e blocos `catch`, o código permanece linear, legível e 100% à prova de exceções ocultas.
