import { CircuitBreaker, CircuitBreakerConfig, CircuitState, RetryPolicy, RetryConfig, RateLimiter, RateLimiterConfig } from "core/resilience";
import { Duration } from "core/time";

func run_resilience_tests() -> Result<Int, String> {
  // 1. Circuit Breaker
  let cb = CircuitBreaker.new("pix-service", CircuitBreakerConfig {
    failure_threshold: 2,
    success_threshold: 1,
    timeout: Duration.millis(50),
    half_open_max_requests: 1
  });

  let mut state_str = "UNKNOWN";
  match cb.state() {
    CircuitState.Closed { state_str = "CLOSED"; },
    CircuitState.Open { state_str = "OPEN"; },
    CircuitState.HalfOpen { state_str = "HALF_OPEN"; }
  }
  print("CB INITIAL: ${state_str}");

  cb.execute(|| { return Result.Ok("ok"); });
  cb.execute(|| { return Result.Err("fail 1"); });
  cb.execute(|| { return Result.Err("fail 2"); });

  match cb.state() {
    CircuitState.Closed { state_str = "CLOSED"; },
    CircuitState.Open { state_str = "OPEN"; },
    CircuitState.HalfOpen { state_str = "HALF_OPEN"; }
  }
  print("CB AFTER FAILS: ${state_str}");

  let fast_fail = cb.execute(|| { return Result.Ok("bad"); });
  match fast_fail {
    Result.Ok(_) { print("FAST FAIL UNEXPECTED OK"); },
    Result.Err(e) { print("FAST FAIL ERR: ${e}"); }
  }

  // 2. Retry Policy
  let rp = RetryPolicy.new(RetryConfig {
    max_attempts: 3,
    initial_delay: Duration.millis(5),
    max_delay: Duration.millis(50),
    backoff_multiplier: 2.0,
    use_jitter: false
  });

  let mut attempts = 0;
  let retry_res = rp.run(|| {
    attempts = attempts + 1;
    if attempts < 3 {
      return Result.Err("temp error");
    }
    return Result.Ok("recovered");
  });

  match retry_res {
    Result.Ok(val) { print("RETRY OK: ${val} in ${attempts} attempts"); },
    Result.Err(e) { print("RETRY FAIL: ${e}"); }
  }

  // 3. Rate Limiter
  let limiter = RateLimiter.new(RateLimiterConfig {
    rate_per_second: 10,
    burst_capacity: 2
  });

  let l1 = limiter.allow();
  let l2 = limiter.allow();
  let l3 = limiter.allow();

  print("LIMITER 1: ${l1}");
  print("LIMITER 2: ${l2}");
  print("LIMITER 3: ${l3}");

  return Result.Ok(1);
}

match run_resilience_tests() {
  Result.Ok(_) { print("RESILIENCE SUITE SUCCESS"); },
  Result.Err(e) { print("ERROR: ${e}"); }
}
