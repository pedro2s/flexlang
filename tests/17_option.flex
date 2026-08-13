// Teste 17: Option<T> embutido, com ? propagando None como "nao encontrado"

struct User {
    id: Int,
    name: String
}

func find_user(id: Int) -> Option<User> {
    if id == 0 {
        return Option.None;
    }
    return Option.Some(User { id: id, name: "Ana" });
}

// O ? propaga o None sem nenhum tipo de erro explicito no caminho
func nome_do_usuario(id: Int) -> Option<String> {
    let u = find_user(id)?;
    return Option.Some(u.name);
}

func mostra(id: Int) -> Void {
    match nome_do_usuario(id) {
        Option.Some(nome) => {
            print("encontrado:");
            print(nome);
        },
        Option.None => {
            print("nao encontrado");
        }
    }
}

mostra(7);
mostra(0);
