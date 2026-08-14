// Modulo de repositorio de usuarios
import { User } from "./user";

func find_user(id: Int) -> Result<User, String> {
    if id == 1 {
        return Result.Ok(User { id: 1, name: "Alice" });
    }
    if id == 2 {
        return Result.Ok(User { id: 2, name: "Bob" });
    }
    return Result.Err("Usuario nao encontrado");
}
