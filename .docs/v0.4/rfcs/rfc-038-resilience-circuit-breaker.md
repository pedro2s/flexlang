# RFC-038 — Módulo de Resiliência: Circuit Breaker, Retries e Rate Limiting (`core/resilience`)

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** RFC-027 (`core/time`), RFC-031 (`net/http: Client`)

---

## 1. Motivação

Em integrações bancárias de missão crítica (ex: BACEN, birôs de crédito e gateways de cartão), **falhas externas são inevitáveis**. Sem mecanismos de resiliência:
1. Uma lentidão de 30s no Banco Central consome todas as conexões do servidor bancário, causando **colapso em cascata**.
2. Retries cegos e imediatos causam efeito de **avalanche (*thundering herd*)** no serviço com problemas.

Esta RFC introduz o módulo `core/resilience` contendo:
- **Circuit Breaker** (Estados `CLOSED`, `OPEN`, `HALF_OPEN`).
- **Retry Policy** com *Exponential Backoff* e *Jitter*.
- **Rate Limiter** baseado em *Token Bucket*.

---

## 2. Design da API

### 2.1 Circuit Breaker

```flexlang
import { CircuitBreaker, CircuitBreakerConfig, CircuitState } from "core/resilience";
import { Duration } from "core/time";

// Cria instância de Circuit Breaker para o serviço do BACEN
let bacen_cb = CircuitBreaker.new("bacen-pix-service", CircuitBreakerConfig {
    failure_threshold: 5,                  // Abre o circuito após 5 falhas consecutivas
    success_threshold: 2,                  // 2 sucessos em HALF_OPEN fecham o circuito
    timeout: Duration.seconds(30),         // Tempo que permanece em OPEN antes de testar HALF_OPEN
    half_open_max_requests: 3              // Máximo de requisições de teste em HALF_OPEN
});

// Executa chamada protegida pelo Circuit Breaker
let result = bacen_cb.execute(|| {
    return client.get("https://spi.bacen.gov.br/api/v1/health");
}) catch err {
    if bacen_cb.state() == CircuitState.Open {
        // Circuito aberto: responde imediatamente com fallback sem onerar a rede
        return Result.Err("BACEN_CIRCUIT_OPEN_FAST_FALLBACK");
    }
    return Result.Err(err);
};
```

---

### 2.2 Política de Retry com Exponential Backoff e Jitter

```flexlang
import { RetryPolicy, RetryConfig } from "core/resilience";
import { Duration } from "core/time";

let retry_policy = RetryPolicy.new(RetryConfig {
    max_attempts: 3,
    initial_delay: Duration.millis(200),
    max_delay: Duration.seconds(2),
    backoff_multiplier: 2.0,
    use_jitter: true                       // Adiciona aleatoriedade para evitar sincronia de retries
});

let response = retry_policy.run(|| {
    return client.post("https://api.antifraude.com.br/analyze", payload);
})?;
```

---

### 2.3 Rate Limiter Nativo (Token Bucket)

```flexlang
import { RateLimiter, RateLimiterConfig } from "core/resilience";

// Permite no máximo 100 requisições por segundo, com burst de até 20
let limiter = RateLimiter.new(RateLimiterConfig {
    rate_per_second: 100,
    burst_capacity: 20
});

if !limiter.allow() {
    res.status(429).json({ error: "TOO_MANY_REQUESTS" });
    return;
}
```

---

## 3. Implementação e Paridade

### 3.1 Modo Interpretado (TypeScript)
- Máquina de estados atômica para o Circuit Breaker com temporizadores baseados em `Date.now()`.
- Algoritmo de Token Bucket de precisão de milissegundos.

### 3.2 Modo Compilado (Go)
- Mapeia para o pacote `github.com/sony/gobreaker` ou implementação nativa em Go com `sync/atomic` e `time.Ticker` para taxa máxima de throughput.

---

## 4. Plano de Testes

- Teste de abertura de circuito após N falhas simuladas.
- Teste de retorno rápido com erro de circuito aberto (Fast-Fail).
- Teste de transição `OPEN` → `HALF_OPEN` → `CLOSED` após sucessos.
- Teste de cálculo de delays exponenciais no retry.
- Paridade estrita nos dois runtimes.
