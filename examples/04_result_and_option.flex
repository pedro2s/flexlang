// FlexLang: Result<T, E> e Option<T> (RFC-002)
// Demonstra o tratamento funcional de erros e valores ausentes sem null ou exceções.

struct Product {
    id: Int,
    name: String,
    price: Int
}

// Retorna Option<Product> para modelar buscas que podem nao encontrar o item
func find_product_by_id(id: Int) -> Option<Product> {
    if id == 101 {
        return Option.Some(Product { id: 101, name: "Teclado Mecanico", price: 250 });
    }
    if id == 102 {
        return Option.Some(Product { id: 102, name: "Mouse Gamer", price: 150 });
    }
    return Option.None;
}

// Retorna Result<Int, String> para operacoes suscetiveis a falha com mensagem de erro
func apply_discount(product: Product, discount_percent: Int) -> Result<Int, String> {
    if discount_percent < 0 || discount_percent > 50 {
        return Result.Err("Desconto invalido! Deve estar entre 0 e 50%.");
    }
    let discount_val = (product.price * discount_percent) / 100;
    return Result.Ok(product.price - discount_val);
}

// O operador '?' propaga erros ou valores ausentes automaticamente
func calculate_checkout_price(id: Int, discount_percent: Int) -> Result<Int, String> {
    let product_opt = find_product_by_id(id);
    match product_opt {
        Option.Some(prod) => {
            let final_price = apply_discount(prod, discount_percent)?;
            return Result.Ok(final_price);
        },
        Option.None => {
            return Result.Err("Produto nao encontrado no estoque.");
        }
    }
    return Result.Err("Inalcancavel");
}

// 1. Caso de Sucesso
print("--- Testando Checkout com Sucesso ---");
match calculate_checkout_price(101, 10) {
    Result.Ok(price) => {
        print("Preco final com desconto: R$ ${price}");
    },
    Result.Err(err) => {
        print("Erro: ${err}");
    }
}

// 2. Caso de Desconto Invalido
print("");
print("--- Testando Checkout com Desconto Invalido ---");
match calculate_checkout_price(102, 80) {
    Result.Ok(price) => {
        print("Preco final: R$ ${price}");
    },
    Result.Err(err) => {
        print("Falha controlada: ${err}");
    }
}

// 3. Caso de Produto Inexistente
print("");
print("--- Testando Checkout com Produto Inexistente ---");
match calculate_checkout_price(999, 10) {
    Result.Ok(price) => {
        print("Preco final: R$ ${price}");
    },
    Result.Err(err) => {
        print("Falha controlada: ${err}");
    }
}
