// Teste 15: Teste negativo — match nao-exaustivo deve ser barrado pelo checker,
// antes de chegar no transpiler (nenhum Go chega a ser gerado).

enum Status {
    Ativo,
    Inativo,
    Suspenso
}

func descreve(s: Status) -> Void {
    match s {
        Status.Ativo => {
            print("ativo");
        },
        Status.Inativo => {
            print("inativo");
        }
    }
}

descreve(Status.Ativo);
