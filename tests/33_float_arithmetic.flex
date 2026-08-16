// Teste 33: Tipo Float, paridade aritmetica, divisoes truncadas e conversoes
// Valida a paridade completa entre interpretado e compilado (RFC-013)

// 1. Divisao inteira truncada em direcao a zero (igual a Go int/int)
let d1 = 7 / 2;
print(d1);
let d2 = -7 / 2;
print(d2);
let d3 = 1 / 2;
print(d3);
let d4 = -1 / 2;
print(d4);

// 2. Aritmetica basica com Float
let preco: Float = 19.90;
let taxa: Float = 1.50;
print(preco + taxa);
print(preco - taxa);
print(preco * taxa);
print(preco / taxa);

// 3. Literais untyped promovidos pelo contexto
let com_desconto = preco * 2;
print(com_desconto);
let total: Float = 10;
print(total);
let float_com_untyped = 2 * taxa;
print(float_com_untyped);
let divisao_float = 7.0 / 2.0;
print(divisao_float);
let divisao_untyped1 = 7.0 / 2;
print(divisao_untyped1);
let divisao_untyped2 = 7 / 2.0;
print(divisao_untyped2);

// 4. Conversoes explicitas to_float() e to_int()
let n: Int = 3;
let f_conv = n.to_float();
print(f_conv);
let p_val: Float = 19.90;
let i_conv = p_val.to_int();
print(i_conv);
let neg_f: Float = -19.90;
print(neg_f.to_int());
let round_trip = (7 / 2).to_float();
print(round_trip);

// 5. Divisao por zero em Float (IEEE-754)
let zero_f: Float = 0.0;
let inf_pos = 7.0 / zero_f;
print(inf_pos);
let inf_neg = -7.0 / zero_f;
print(inf_neg);
let nan_val = 0.0 / zero_f;
print(nan_val);

// 6. Formatacao em print
let f1: Float = 3.0;
print(f1);
let f2: Float = 3.5;
print(f2);
let a: Float = 0.1;
let b: Float = 0.2;
print(a + b);
let neg_zero: Float = -0.0;
print(neg_zero);
let small: Float = 0.0000000001;
print(small);

// 7. Comparacoes relacionais e igualdade com Float
print(preco > 10.0);
print(preco > 10);
print(preco == 19.90);
print(preco != 20.0);

// 8. Unario negativo em Float
print(-preco);
print(--preco);

// 9. Struct com campo Float
struct Produto {
    nome: String,
    preco: Float,
    quantidade: Int
}

let prod = Produto { nome: "Cafe", preco: 12.50, quantidade: 2 };
print(prod.nome);
print(prod.preco);
print(prod.preco * prod.quantidade.to_float());
