// FlexLang: Persistência com PostgreSQL (RFC-005)
// Demonstra Pool de Conexões, Queries Parametrizadas Seguras ($1, $2),
// Leitura de Linhas e Transações Atômicas com Rollback Automático em Lambdas.

import { Pool, Tx } from "db/postgres";

func demo_postgres() {
    print("--- 1. Conectando ao Pool de PostgreSQL ---");
    let url = "postgres://postgres:postgres@localhost:5432/postgres";
    let pool_res = Pool.connect(url);
    
    match pool_res {
        Result.Ok(pool) {
            print("Conectado com sucesso!");

            // 1. Criar tabela temporária para testes
            pool.execute("CREATE TEMP TABLE users_demo (id SERIAL PRIMARY KEY, name TEXT, balance INT)", []);
            
            // 2. Inserir registros com queries parametrizadas (proteção contra SQL Injection)
            pool.execute("INSERT INTO users_demo (name, balance) VALUES ($1, $2)", ["Alice", "1000"]);
            pool.execute("INSERT INTO users_demo (name, balance) VALUES ($1, $2)", ["Bob", "500"]);
            print("Registros de teste inseridos!");

            // 3. Consultar linhas com query parametrizada
            print("");
            print("--- 2. Consultando Dados com Query Parametrizada ---");
            let rows_res = pool.query("SELECT id, name, balance FROM users_demo WHERE balance >= $1 ORDER BY id", [500]);
            match rows_res {
                Result.Ok(rows) {
                    print("Usuarios encontrados com saldo >= R$ 500:");
                    print(rows);
                },
                Result.Err(err) {
                    print("Erro na consulta: ${err}");
                }
            }

            // 4. Consultar registro único (query_one)
            print("");
            print("--- 3. Consultando Registro Unico (query_one) ---");
            let user_res = pool.query_one("SELECT id, name, balance FROM users_demo WHERE id = $1", [1]);
            match user_res {
                Result.Ok(user) {
                    print("Usuario encontrado: ");
                    print(user);
                },
                Result.Err(err) {
                    print("Erro no query_one: ${err}");
                }
            }

            // 5. Transação Atômica ACID via Lambda
            // Se o lambda executa com sucesso, o commit e automatico.
            // Se houver falha ou erro, o rollback e disparado garantindo atomicidade.
            print("");
            print("--- 4. Executando Transacao Atomica (Transferencia de Saldo) ---");
            let tx_res = pool.transaction(|tx: Tx| {
                // Debita da Alice
                tx.execute("UPDATE users_demo SET balance = balance - $1 WHERE id = $2", [200, 1]);
                // Credita no Bob
                tx.execute("UPDATE users_demo SET balance = balance + $1 WHERE id = $2", [200, 2]);
            });

            match tx_res {
                Result.Ok(v) {
                    print("Transferencia de R$ 200 concluida com sucesso via transacao!");
                },
                Result.Err(err) {
                    print("Falha na transacao (rollback automatico executado): ${err}");
                }
            }
        },
        Result.Err(err) {
            print("PostgreSQL nao disponivel em ${url} (${err})");
            print("Para rodar localmente: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres");
        }
    }
}

demo_postgres();
