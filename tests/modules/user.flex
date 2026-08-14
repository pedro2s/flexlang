// Modulo de definicao de modelo de Usuario
struct User {
    id: Int,
    name: String
}

impl User {
    func greeting() -> String {
        return "Ola, meu nome e ${self.name}";
    }
}
