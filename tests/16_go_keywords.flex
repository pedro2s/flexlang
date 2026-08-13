// Teste 16: Identificadores validos em FlexLang que sao palavras reservadas do Go.
// O programa e legal na linguagem; o transpiler e que precisa renomear na saida.

struct Registro {
    type: Int,
    range: Int
}

enum Select {
    Chan(Int),
    Package
}

// `main` colide com o entrypoint gerado pelo transpiler
func main() -> Int {
    let map = 10;
    let select = 20;
    print(map + select);

    let r = Registro { type: 1, range: 2 };
    print(r.type + r.range);

    match Select.Chan(7) {
        Select.Chan(var) => {
            print(var);
        },
        Select.Package => {
            print("sem payload");
        }
    }

    return 0;
}

let const = main();
print(const);
