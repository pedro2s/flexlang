// Camada de Dominio: Modelos de Entidade
struct User {
    id: Int,
    name: String,
    email: String,
    is_admin: Bool
}

impl User {
    func display_info() -> String {
        return "Usuario #${self.id}: ${self.name} (${self.email})";
    }
}
