// Teste 12: Variantes de enum sem payload, com multiplos campos e match aninhado

enum Forma {
    Ponto,
    Circulo(Int),
    Retangulo(Int, Int)
}

enum Cor {
    Vermelho,
    Azul
}

func descreve(f: Forma, c: Cor) -> Void {
    match f {
        Forma.Ponto => {
            print("um ponto");
        },
        Forma.Circulo(raio) => {
            print("circulo de raio:");
            print(raio);
            // match aninhado dentro de um braco de match
            match c {
                Cor.Vermelho => {
                    print("pintado de vermelho");
                },
                Cor.Azul => {
                    print("pintado de azul");
                }
            }
        },
        Forma.Retangulo(largura, altura) => {
            print("area do retangulo:");
            print(largura * altura);
        }
    }
}

// Braco que ignora completamente o payload da variante
func conta_lados(f: Forma) -> Int {
    match f {
        Forma.Ponto => {
            print("sem lados");
        },
        Forma.Circulo(raio) => {
            print("circulo nao tem lados");
        },
        Forma.Retangulo(largura, altura) => {
            print("quatro lados");
        }
    }
    return 0;
}

descreve(Forma.Ponto, Cor.Azul);
descreve(Forma.Circulo(3), Cor.Vermelho);
descreve(Forma.Retangulo(4, 5), Cor.Azul);

conta_lados(Forma.Circulo(1));
conta_lados(Forma.Retangulo(2, 2));
