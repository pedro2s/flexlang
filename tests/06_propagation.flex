// Teste 06: Operador de Propagacao (?)

enum Result {
    Ok(Int),
    Err(String)
}

func divide(a: Int, b: Int) -> Result {
    if b == 0 {
        return Result::Err("Divisao por zero!");
    }
    return Result::Ok(a / b); // Divisao basica inteira vai requerer math de verdade no futuro, mas o AST parser vai dar evaluate. Na real, JS divide float, entao 10/2 = 5
}

func calcula() -> Result {
    let mut x = divide(10, 2)?;
    print("Divisao 1 OK:");
    print(x);
    
    let y = divide(x, 0)?; // Retorna prematuramente Result::Err
    
    print("Isso nao deve ser impresso");
    return Result::Ok(y);
}

let res = calcula();

match res {
    Result::Ok(v) => {
        print("Sucesso absoluto:");
        print(v);
    },
    Result::Err(e) => {
        print("Falhou propagando o erro:");
        print(e);
    }
}
