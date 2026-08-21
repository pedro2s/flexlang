import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

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

async function main() {
  console.log("\n== Teste de Integração: Módulo de Resiliência (RFC-038) ==");

  const flexCode = `
    import { CircuitBreaker, CircuitBreakerConfig, CircuitState, RetryPolicy, RetryConfig, RateLimiter, RateLimiterConfig } from "core/resilience";
    import { Duration } from "core/time";

    // 1. Circuit Breaker Lifecycle
    let cb = CircuitBreaker.new("test-service", CircuitBreakerConfig {
      failure_threshold: 2,
      success_threshold: 1,
      timeout: Duration.millis(50),
      half_open_max_requests: 1
    });

    let mut state_init = "CLOSED";
    match cb.state() {
      CircuitState.Closed { state_init = "CLOSED"; },
      CircuitState.Open { state_init = "OPEN"; },
      CircuitState.HalfOpen { state_init = "HALF_OPEN"; }
    }
    print("cb_init: \${state_init}");

    // Sucesso inicial
    cb.execute(|| { return Result.Ok("ok_1"); });

    // Falha 1
    cb.execute(|| { return Result.Err("error_1"); });

    // Falha 2 -> deve abrir o circuito
    cb.execute(|| { return Result.Err("error_2"); });

    let mut state_after_failures = "UNKNOWN";
    match cb.state() {
      CircuitState.Closed { state_after_failures = "CLOSED"; },
      CircuitState.Open { state_after_failures = "OPEN"; },
      CircuitState.HalfOpen { state_after_failures = "HALF_OPEN"; }
    }
    print("cb_after_failures: \${state_after_failures}");

    // Fast-fail quando OPEN
    let fast_fail_res = cb.execute(|| { return Result.Ok("should_not_run"); });
    match fast_fail_res {
      Result.Ok(_) { print("fast_fail: FAILED"); },
      Result.Err(e) { print("fast_fail: \${e}"); }
    }

    // 2. Retry Policy
    let retry_policy = RetryPolicy.new(RetryConfig {
      max_attempts: 3,
      initial_delay: Duration.millis(5),
      max_delay: Duration.millis(50),
      backoff_multiplier: 2.0,
      use_jitter: false
    });

    let mut attempts = 0;
    let retry_res = retry_policy.run(|| {
      attempts = attempts + 1;
      if attempts < 3 {
        return Result.Err("falha temporaria");
      }
      return Result.Ok("sucesso_na_terceira");
    });

    match retry_res {
      Result.Ok(val) { print("retry_success: \${val} (tentativas: \${attempts})"); },
      Result.Err(e) { print("retry_success: FAILED (\${e})"); }
    }

    // 3. Rate Limiter (Token Bucket)
    let limiter = RateLimiter.new(RateLimiterConfig {
      rate_per_second: 10,
      burst_capacity: 2
    });

    let allow_1 = limiter.allow();
    let allow_2 = limiter.allow();
    let allow_3 = limiter.allow(); // deve ser rejeitado (burst 2 esgotado)

    print("limiter_1: \${allow_1}");
    print("limiter_2: \${allow_2}");
    print("limiter_3: \${allow_3}");
  `;

  const ast = new Parser(new Lexer(flexCode).tokenize()).parse();
  new TypeChecker().check(ast);

  let output = "";
  const interpreter = new Interpreter((msg) => {
    output += msg + "\n";
  });
  await interpreter.run(ast);

  check("Circuit Breaker inicia no estado CLOSED", output.includes("cb_init: CLOSED"));
  check("Circuit Breaker abre após atingir failure_threshold (OPEN)", output.includes("cb_after_failures: OPEN"));
  check("Fast-Fail rejeita chamadas com erro sem executar quando OPEN", output.includes("fast_fail: circuit breaker is OPEN"));
  check("Retry Policy repete até o sucesso na 3ª tentativa", output.includes("retry_success: sucesso_na_terceira (tentativas: 3)"));
  check("Rate Limiter permite burst de 2 requisições", output.includes("limiter_1: true") && output.includes("limiter_2: true"));
  check("Rate Limiter bloqueia a 3ª requisição em excesso de burst", output.includes("limiter_3: false"));

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
