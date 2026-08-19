import { dotenv, DotenvConfig } from "config/dotenv";
import { env } from "os/env";

print("Iniciando Teste Dotenv...");

// O parse interno é validado implicitamente pela injeção no ambiente (Teste 2).

// Teste 2: Load File
// A fixture espera que o runner crie o arquivo .env.test antes de rodar
let res = dotenv.load_file(".env.test");
match res {
    Result.Ok(val) {
        print("Arquivo .env.test carregado com sucesso!");
    },
    Result.Err(err) {
        print("Erro ao carregar .env.test: ${err}");
    }
}

// Verificando os envs injetados
let api_key = env.get_or("FLEX_API_KEY", "missing");
print("FLEX_API_KEY do env: ${api_key}");

let interpolated = env.get_or("FLEX_ENDPOINT", "missing");
print("FLEX_ENDPOINT do env: ${interpolated}");

print("Dotenv concluido");
