// Modelos de Domínio e Tipos de Dados da API Le Salvi

enum UserRole {
    Admin,
    Professional,
    Client
}

enum AppointmentStatus {
    Scheduled,
    InProgress,
    Completed,
    Cancelled
}

struct User {
    id: Int,
    name: String,
    email: String,
    role: String
}

struct SalonService {
    id: Int,
    title: String,
    duration_min: Int,
    price: Float
}

struct Appointment {
    id: Int,
    client_name: String,
    professional_name: String,
    service_title: String,
    price: Float,
    status: String
}

struct LoginRequest {
    email: String,
    password: String
}

struct CreateAppointmentRequest {
    client_name: String,
    professional_name: String,
    service_title: String,
    price: Float
}

struct UpdateStatusRequest {
    status: String
}
