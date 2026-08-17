// Teste 26: db/postgres - superficie do modulo (RFC-005)
// Cobertura de checker/parser/transpiler para a API do Pool e transacoes.
// Nao conecta em banco real — so valida que a sintaxe, tipagem e transpilacao
// da superficie funcionam de ponta a ponta (igual ao que o 23_http_v1 faz
// para net/http). O Pool.connect retorna Result.Err quando nao ha banco.

import { Pool } from "db/postgres";

// Pool.connect retorna Result<Pool, String>
// Sem banco real, vai dar Err — testamos o match sobre o resultado
match Pool.connect("postgres://localhost:5432/inexistente") {
    Result.Ok(db) {
        print("conectado");
    },
    Result.Err(msg) {
        print("erro esperado");
    }
}

print("superficie ok");
