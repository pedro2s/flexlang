// Teste 34: Teste negativo — variavel Float nao opera com variavel Int sem conversao explicita (RFC-013 §4.3)
let preco: Float = 19.90;
let quantidade: Int = 3;
let errado = preco * quantidade;
