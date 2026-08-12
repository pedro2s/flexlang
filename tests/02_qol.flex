// Teste 02: Melhorias Básicas (Fase 0.5)

// 1. Arrays e Indexação
let arr = [10, 20, 30];
print(arr[1]); // 20
arr[1] = 99;
print(arr[1]); // 99

// 2. Operadores Unários e Lógicos
let a = !false;
let b = -arr[0]; // -10
print(a); // true
print(b); // -10

if a && (b < 0) {
    print("Logica OK");
}

let c = false || true;
print(c); // true

// 3. Modulo e While
/*
  Este é um comentário
  multilinha
*/
let count = 0;
while count < 5 {
    if count % 2 == 0 {
        print(count); // 0, 2, 4
    }
    count = count + 1;
}

// 4. Interpolação de Strings
let name = "Mundo";
print("Ola ${name}, o valor de b eh ${b} e o array no indice 2 eh ${arr[2]}!");
