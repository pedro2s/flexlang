// Modelos de Autenticação (RFC-030)

struct User {
    id: String,
    name: String,
    email: String,
    password_hash: String
}

struct SessionToken {
    token: String,
    user_id: String,
    expires_at: String
}

struct RegisterRequest {
    name: String,
    email: String,
    cpf: String,
    password: String
}

struct LoginRequest {
    email: String,
    password: String
}
