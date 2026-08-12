// Teste 01: Fundamentos da Linguagem

// Variáveis e Precedência
let x = 10;
let y = 20;
let z = x + y * 2;
print(z); // 50

let w = (x + y) * 2;
print(w); // 60

// Structs e Atribuição
struct Point {
    x: Int,
    y: Int
}

impl Point {
    func set_x(new_x: Int) {
        self.x = new_x; // Testando AssignmentExpr em MemberExpr
    }
}

let p = Point { x: 5, y: 10 };
p.set_x(100); // Testando ExpressionStatement com chamada
print(p.x); // 100

// Controle de fluxo
if p.x > 50 {
    print("X é grande");
} else {
    print("X é pequeno");
}

// Closures e Lexical Scoping
func create_counter(start: Int) -> Int {
    let limit = start + 5;
    // Closure: captura start e limit
    func do_count() {
        for i in start..limit {
            print(i);
        }
    }
    do_count(); // Testando chamada de closure
    return 0;
}

create_counter(10);
