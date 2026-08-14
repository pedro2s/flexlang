// Camada de Acesso a Dados (Repositório)
import { User } from "../models/user";

func find_user_by_id(id: Int) -> Option<User> {
    if id == 1 {
        return Option.Some(User {
            id: 1,
            name: "Alice Developer",
            email: "alice@empresa.com",
            is_admin: true
        });
    }
    if id == 2 {
        return Option.Some(User {
            id: 2,
            name: "Bob Junior",
            email: "bob@empresa.com",
            is_admin: false
        });
    }
    return Option.None;
}

func save_user(user: User) -> Result<Int, String> {
    if user.id <= 0 {
        return Result.Err("ID de usuario invalido para persistencia.");
    }
    return Result.Ok(user.id);
}
