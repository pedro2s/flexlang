// Teste 10: Traits com falha

trait Animal {
    func speak();
}

struct Dog {
    name: String
}

impl Animal for Dog {
    // Esqueceu de implementar speak!
    func foo() {
        print("Oops");
    }
}
