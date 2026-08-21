import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";
import Redis from "ioredis";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ${green("[PASS]")} ${label}`);
    passed++;
  } else {
    console.log(`  ${red("[FAIL]")} ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function isRedisAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new Redis({
      host: "127.0.0.1",
      port: 6379,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
    });
    client.on("connect", () => {
      client.disconnect();
      resolve(true);
    });
    client.on("error", () => {
      client.disconnect();
      resolve(false);
    });
  });
}

async function main() {
  console.log("\n== Teste de Integração Redis (RFC-036) ==");
  const available = await isRedisAvailable();

  if (!available) {
    console.log(
      yellow("\n[SKIP] Redis não está acessível em 127.0.0.1:6379.\n       Para rodar os testes completos, inicie um servidor Redis local (ex: docker run -p 6379:6379 redis).\n"),
    );
    return;
  }

  const flexCode = `
    import { Redis, RedisConfig, RedisLock } from "db/redis";
    import { Duration } from "core/time";

    func test_redis() -> Result<Int, String> {
      let redis = Redis.connect(RedisConfig {
        host: "127.0.0.1",
        port: 6379,
        password: Option.None,
        db: 0,
        max_pool_size: 10,
        connect_timeout: Duration.seconds(2)
      })?;

      // 1. Limpa chaves antes de testar
      redis.del("test:key1")?;
      redis.del("test:key_lock")?;

      // 2. Set Ex / Get
      redis.set_ex("test:key1", "foo", Duration.seconds(5))?;
      let val = redis.get("test:key1")?;
      
      // 3. Incremento atômico
      redis.del("test:counter")?;
      let c1 = redis.incr("test:counter")?;
      let c2 = redis.incr("test:counter")?;

      // 4. Distributed Lock (Sucesso na primeira e falha na concorrência)
      let lock = redis.acquire_lock("test:key_lock", Duration.seconds(10))?;
      match redis.acquire_lock("test:key_lock", Duration.seconds(10)) {
         Result.Ok(l) { return Result.Err("Deveria ter falhado na concorrencia"); },
         Result.Err(e) { print("bloqueado_corretamente"); }
      }

      // 5. Liberação do lock
      lock.release()?;
      
      // Validação rápida de lógica
      if c2 != 2 {
          return Result.Err("incremento_falhou");
      }

      return Result.Ok(1);
    }

    match test_redis() {
      Result.Ok(v) { print("suite_completa_ok"); },
      Result.Err(e) { print("erro: \${e}"); }
    }
  `;

  const ast = new Parser(new Lexer(flexCode).tokenize()).parse();
  new TypeChecker().check(ast);
  
  let captured = "";
  const interpreter = new Interpreter((msg) => { captured += msg + "\n"; });
  await interpreter.run(ast);

  check("Operações nativas do Redis (Set, Get, Incr, Del, Lock Atômico) executadas", captured.includes("suite_completa_ok"), captured);

  console.log(`\nRedis integration: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
