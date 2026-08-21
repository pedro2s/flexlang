---
title: core/resilience — Circuit Breaker, Retry & Rate Limiter
description: Padrões avançados de resiliência e estabilidade para backends enterprise e chamadas de rede distribuídas.
---

O módulo `core/resilience` implementa padrões de estabilidade essenciais para arquiteturas distribuídas: **Circuit Breaker** (com estados Closed, Open, HalfOpen), **Retry Policy** (com backoff exponencial e jitter) e **Rate Limiter** (token bucket).

```flexlang
import { CircuitBreaker, CircuitBreakerConfig, RetryPolicy, RetryConfig, RateLimiter, RateLimiterConfig } from "core/resilience";
import { Duration } from "core/time";
```

---

## ⚡ 1. Circuit Breaker

Protege sua aplicação contra efeito cascata quando serviços externos ficam instáveis.

```flexlang
let cb_config = CircuitBreakerConfig {
    failure_threshold: 5,        // Abre o circuito após 5 falhas consecutivas
    success_threshold: 2,        // Fecha novamente após 2 sucessos em HalfOpen
    timeout: Duration.seconds(10), // Permanece OPEN por 10 segundos antes de tentar HalfOpen
    half_open_max_requests: 1
};

let breaker = CircuitBreaker.new("bacen_spi_gateway", cb_config);

// Execução protegida
let result = breaker.execute(|| {
    // Chamada de rede arriscada
    return client.post_json("https://api.bacen.gov.br/transfer", payload);
});

match result {
    Result.Ok(res) {
        print("Sucesso na chamada");
    },
    Result.Err(err) {
        print("Falha ou circuito aberto: ${err}");
    }
}
```

---

## 🔁 2. Retry Policy (com Backoff & Jitter)

```flexlang
let retry_policy = RetryPolicy.new(RetryConfig {
    max_attempts: 3,
    initial_delay: Duration.millis(200),
    max_delay: Duration.seconds(2),
    backoff_multiplier: 2.0,
    use_jitter: true // Jitter evita efeito manada no servidor de destino
});

let resp = retry_policy.execute(|| {
    return query_payment_status("tx_99812");
});
```

---

## 🚦 3. Rate Limiter (Token Bucket)

Limita o número de requisições por segundo por cliente ou por rota:

```flexlang
let limiter = RateLimiter.new(RateLimiterConfig {
    rate_per_second: 100, // 100 tokens por segundo
    burst_capacity: 150   // Capacidade máxima de burst
});

if (limiter.allow()) {
    // Processa requisição
} else {
    // Retorna HTTP 429 Too Many Requests
}
```
