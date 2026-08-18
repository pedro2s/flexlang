// Teste RFC-020: Métodos de Array

func test_immutable_methods() {
    print("--- Teste Metodos Imutaveis ---");
    let arr = [10, 20, 30];
    let l = arr.len();
    let empty = arr.is_empty();
    let c20 = arr.contains(20);
    let c99 = arr.contains(99);

    print("Len: ${l}");
    print("Is empty: ${empty}");
    print("Contains 20: ${c20}");
    print("Contains 99: ${c99}");

    let sub = arr.slice(1, 3);
    for x in sub {
        print("Slice: ${x}");
    }

    let extra = [40, 50];
    let concatenated = arr.concat(extra);
    for x in concatenated {
        print("Concat: ${x}");
    }
}

func test_higher_order_methods() {
    print("--- Teste Metodos Funcionais ---");
    let nums = [5, 12, 18, 25];

    let doubled = nums.map(|x| {
        return x * 2;
    });
    for d in doubled {
        print("Doubled: ${d}");
    }

    let above_fifteen = nums.filter(|x| {
        return x > 15;
    });
    for f in above_fifteen {
        print("Filtered: ${f}");
    }

    nums.for_each(|x| {
        print("ForEach: ${x}");
    });

    match nums.find(|x| { return x == 18; }) {
        Option.Some(val) {
            print("Found: ${val}");
        },
        Option.None {
            print("Not found");
        }
    }

    match nums.find(|x| { return x == 999; }) {
        Option.Some(val) {
            print("Found: ${val}");
        },
        Option.None {
            print("Not found 999");
        }
    }
}

func test_mutable_methods() {
    print("--- Teste Metodos Mutaveis ---");
    let mut lista = [30, 10];
    lista.push(20);
    lista.push(5);

    lista.sort();
    for item in lista {
        print("Sorted: ${item}");
    }

    match lista.pop() {
        Option.Some(popped) {
            print("Popped: ${popped}");
        },
        Option.None {
            print("Empty pop");
        }
    }

    let remaining_len = lista.len();
    print("Remaining len: ${remaining_len}");

    let mut empty_list: [Int] = [];
    match empty_list.pop() {
        Option.Some(v) {
            print("Popped: ${v}");
        },
        Option.None {
            print("Empty list popped None");
        }
    }
}

func main() {
    test_immutable_methods();
    test_higher_order_methods();
    test_mutable_methods();
}

main();
