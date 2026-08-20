import { Redis, RedisConfig, RedisLock } from "db/redis";
import { Duration } from "core/time";

func run_test() -> Result<Int, String> {
  let redis = Redis.connect(RedisConfig {
    host: "127.0.0.1",
    port: 6379,
    password: Option.None,
    db: 0,
    max_pool_size: 10,
    connect_timeout: Duration.seconds(2)
  })?;

  // 1. Limpa chaves antes de testar
  redis.del("parity:key1")?;
  redis.del("parity:key_lock")?;

  // 2. Set Ex / Get
  redis.set_ex("parity:key1", "foo", Duration.seconds(5))?;
  let val = redis.get("parity:key1")?;
  match val {
    Option.Some(v) { print("GET OK: ${v}"); },
    Option.None { print("GET MISS"); }
  }

  // 3. Incremento atômico
  redis.del("parity:counter")?;
  let c1 = redis.incr("parity:counter")?;
  let c2 = redis.incr("parity:counter")?;
  print("INCR: ${c2}");

  // 4. Distributed Lock (Sucesso na primeira e falha na concorrência)
  let lock = redis.acquire_lock("parity:key_lock", Duration.seconds(10))?;
  match redis.acquire_lock("parity:key_lock", Duration.seconds(10)) {
      Result.Ok(l) { print("ERROR: FALLBACK DEVIA FALHAR"); },
      Result.Err(e) { print("LOCK FALLBACK OK"); }
  }

  // 5. Liberação do lock
  lock.release()?;
  print("LOCK RELEASED");
  
  return Result.Ok(1);
}

match run_test() {
  Result.Ok(v) { print("Fim"); },
  Result.Err(e) { print("ERRO MAIN: ${e}"); }
}
