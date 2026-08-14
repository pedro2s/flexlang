// Camada de Negócios e Serviços
import { User } from "../models/user";
import { find_user_by_id, save_user } from "../repository/user_repository";

func promote_user_to_admin(user_id: Int) -> Result<String, String> {
    let user_opt = find_user_by_id(user_id);
    
    match user_opt {
        Option.Some(user) => {
            if user.is_admin {
                return Result.Err("O usuario ${user.name} ja e um Administrador.");
            }
            
            let updated = User {
                id: user.id,
                name: user.name,
                email: user.email,
                is_admin: true
            };
            
            save_user(updated)?;
            return Result.Ok("Usuario ${user.name} promovido a Administrador com sucesso!");
        },
        Option.None => {
            return Result.Err("Usuario com ID ${user_id} nao encontrado no sistema.");
        }
    }
    return Result.Err("Inalcancavel");
}
