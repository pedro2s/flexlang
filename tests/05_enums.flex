// Teste 05: Algebraic Data Types (Enums) e Pattern Matching

enum Status {
    Sucesso(String),
    Erro(Int, String),
    Pendente
}

let s1 = Status.Sucesso("Arquivo baixado com sucesso!");
let s2 = Status.Erro(404, "Nao encontrado");
let s3 = Status.Pendente;

func handle_status(s: Status) -> Void {
    match s {
        Status.Sucesso(msg) {
            print(msg);
        },
        Status.Erro(codigo, msgErro) {
            print("Ocorreu um erro: ");
            print(codigo);
            print(msgErro);
        },
        Status.Pendente {
            print("Aguardando...");
        }
    }
}

handle_status(s1);
handle_status(s2);
handle_status(s3);
