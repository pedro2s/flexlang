---
title: core/resilience — Circuit Breaker, Retry & Rate Limiter
description: Enterprise fault tolerance and stability patterns for distributed backend architectures.
---

The `core/resilience` module implements stability patterns: **Circuit Breaker** (Closed, Open, HalfOpen), **Retry Policy** (exponential backoff with jitter), and **Rate Limiter** (token bucket).

```flexlang
import { CircuitBreaker, CircuitBreakerConfig, RetryPolicy, RetryConfig, RateLimiter, RateLimiterConfig } from "core/resilience";
import { Duration } from "core/time";
```

---

## ⚡ 1. Circuit Breaker

```flexlang
let cb_config = CircuitBreakerConfig {
    failure_threshold: 5,
    success_threshold: 2,
    timeout: Duration.seconds(10),
    half_open_max_requests: 1
};

let breaker = CircuitBreaker.new("bacen_gateway", cb_config);

let result = breaker.execute(|| {
    return client.post_json("https://api.bacen.gov.br/transfer", payload);
});
```

---

## 🔁 2. Retry Policy

```flexlang
let retry_policy = RetryPolicy.new(RetryConfig {
    max_attempts: 3,
    initial_delay: Duration.millis(200),
    max_delay: Duration.seconds(2),
    backoff_multiplier: 2.0,
    use_jitter: true
});

let resp = retry_policy.execute(|| {
    return query_payment_status("tx_99812");
});
```

---

## 🚦 3. Rate Limiter

```flexlang
let limiter = RateLimiter.new(RateLimiterConfig {
    rate_per_second: 100,
    burst_capacity: 150
});

if (limiter.allow()) {
    // Process request
} else {
    // Emit HTTP 429
}
```
