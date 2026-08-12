// Teste 09: Traits com sucesso

trait Greeter {
    func greet();
}

struct Person {
    name: String
}

impl Greeter for Person {
    func greet() {
        print("Saudacoes amigaveis!");
    }
}

let p = Person { name: "Alice" };
p.greet();
