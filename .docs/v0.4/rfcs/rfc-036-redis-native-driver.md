# RFC-036 — Driver Nativo de Cache e Locks Distribuídos (`db/redis`)

> **Status:** Proposto · **Prioridade:** P1 · **Depende de:** RFC-027 (`core/time`)

---

## 1. Motivação e Casos de Uso Bancários

Em um ecossistema bancário escalável com múltiplos servidores concorrentes:
1. **Controle de Concorrência & Anti-Double-Spending**: Duas requisições simultâneas de saque ou Pix na mesma conta não podem executar em paralelo sem um **Lock Distribuído Atômico** (*Distributed Lock* com TTL).
2. **Cache de Consulta de Alto Desempenho**: Cache de saldos, dados cadastrais e limites transacionais com expiração (TTL) em microssegundos.
3. **Rate Limiting em Cluster**: Limitação de chamadas de API por cliente/IP compartilhada entre múltiplos nós do servidor.
4. **Idempotência**: Armazenamento temporário de respostas de transações concluídas indexadas por `Idempotency-Key`.

---

## 2. Design da API

### 2.1 Conexão e Pool do Redis

```flexlang
import { Redis, RedisConfig } from "db/redis";
import { Duration } from "core/time";

// Inicializa conexão poolada com Redis
let redis = Redis.connect(RedisConfig {
    host: "127.0.0.1",
    port: 6379,
    password: Option.None,
    db: 0,
    max_pool_size: 50,
    connect_timeout: Duration.seconds(2)
})?;
```

---

### 2.2 Operações de Chave-Valor com TTL

```flexlang
// 1. Armazenar com TTL (Time-to-Live)
redis.set_ex("balance:acc-12345", "1500.75", Duration.minutes(5))?;

// 2. Leitura de chave
let cached_balance = redis.get("balance:acc-12345")?; // Option<String>
match cached_balance {
    Option.Some(val) { print("Saldo em cache: ${val}"); },
    Option.None { print("Cache miss"); }
}

// 3. Exclusão e invalidação
redis.del("balance:acc-12345")?;

// 4. Operações de incremento atômico (para contadores e rate limiting)
let current_attempts = redis.incr("rate_limit:ip_192.168.1.1")?;
if current_attempts == 1 {
    redis.expire("rate_limit:ip_192.168.1.1", Duration.minutes(1))?;
}
```

---

### 2.3 Locks Distribuídos Atômicos (*Distributed Lock*)

Garante exclusividade mútua entre microsserviços para evitar concorrência destrutiva em contas bancárias:

```flexlang
import { RedisLock } from "db/redis";
import { Duration } from "core/time";

func execute_secure_transfer(account_id: String, amount: Decimal) -> Result<Void, String> {
    // Tenta adquirir lock exclusivo na conta por no máximo 10 segundos
    let lock_key = "lock:account:${account_id}";
    let lock = redis.acquire_lock(lock_key, Duration.seconds(10)) catch err {
        return Result.Err("ACCOUNT_LOCKED_TRY_AGAIN");
    };

    // Executa operações críticas de débito no banco de dados Postgres...
    let transfer_res = process_debit(account_id, amount);

    // Libera o lock atômico garantido
    lock.release()?;

    return transfer_res;
}
```

---

## 3. Implementação e Paridade

### 3.1 Modo Interpretado (TypeScript)
- Utiliza o driver `ioredis` para gerenciamento de pools, reconexão automática e execução de scripts Lua atômicos para liberação segura de locks (`SET NX PX` com verificação de token aleatório).

### 3.2 Modo Compilado (Go)
- O transpiler Go mapeia para o pacote `github.com/redis/go-redis/v9`.
- Emite código thread-safe de alta performance com pool de conexões nativo do Go.

---

## 4. Plano de Testes

- Teste de `set`, `get`, `del` e expiração com TTL.
- Teste de aquisição de Lock Distribuído: segunda tentativa com mesma chave deve falhar ou aguardar.
- Teste de liberação de lock permitindo nova aquisição imediata.
- Parity gate completo validando respostas idênticas.
