import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";
import type { Interpreter } from "../interpreter";
import { FlexDuration } from "./time";

export type FlexCircuitStateVariant = "Closed" | "Open" | "HalfOpen";

function isResultErr(res: unknown): boolean {
  if (res && typeof res === "object") {
    const obj = res as any;
    if (obj.kind === "EnumVariant" && obj.variantName === "Err") return true;
    if (obj.__variantName === "Err" || obj.variantName === "Err") return true;
  }
  return false;
}

function getField<T>(obj: any, key: string, defaultValue: T): T {
  if (!obj) return defaultValue;
  if (obj instanceof Map) {
    const val = obj.get(key);
    return val !== undefined ? (val as T) : defaultValue;
  }
  if (typeof obj === "object" && key in obj) {
    const val = obj[key];
    return val !== undefined ? (val as T) : defaultValue;
  }
  return defaultValue;
}

export class FlexCircuitBreaker {
  readonly [NATIVE_TAG] = "CircuitBreaker";
  private stateVal: FlexCircuitStateVariant = "Closed";
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private halfOpenRequests = 0;
  private lastStateChange = Date.now();
  private failureThreshold: number;
  private successThreshold: number;
  private timeoutDuration: FlexDuration;
  private halfOpenMaxRequests: number;

  constructor(
    private nameStr: string,
    config: any,
    private interpreter: Interpreter,
  ) {
    this.failureThreshold = getField(config, "failure_threshold", 5);
    this.successThreshold = getField(config, "success_threshold", 2);
    this.timeoutDuration = getField(config, "timeout", FlexDuration.seconds(30));
    this.halfOpenMaxRequests = getField(config, "half_open_max_requests", 3);
  }

  async execute(fn: unknown): Promise<unknown> {
    const now = Date.now();
    const timeoutMs = this.timeoutDuration instanceof FlexDuration ? this.timeoutDuration.millis : 30000;

    if (this.stateVal === "Open") {
      if (now - this.lastStateChange >= timeoutMs) {
        this.stateVal = "HalfOpen";
        this.consecutiveSuccesses = 0;
        this.halfOpenRequests = 0;
        this.lastStateChange = now;
      } else {
        return resultErr("circuit breaker is OPEN");
      }
    }

    if (this.stateVal === "HalfOpen") {
      if (this.halfOpenMaxRequests > 0 && this.halfOpenRequests >= this.halfOpenMaxRequests) {
        return resultErr("circuit breaker is HALF_OPEN (max requests reached)");
      }
      this.halfOpenRequests++;
    }

    let res: unknown;
    let isError = false;

    try {
      res = await this.interpreter.callFunction(fn, []);
      if (isResultErr(res)) {
        isError = true;
      }
    } catch (e: any) {
      isError = true;
      res = resultErr(e.message ?? String(e));
    }

    if (!isError) {
      if (this.stateVal === "HalfOpen") {
        this.consecutiveSuccesses++;
        if (this.consecutiveSuccesses >= this.successThreshold) {
          this.stateVal = "Closed";
          this.consecutiveFailures = 0;
          this.consecutiveSuccesses = 0;
          this.halfOpenRequests = 0;
          this.lastStateChange = Date.now();
        }
      } else if (this.stateVal === "Closed") {
        this.consecutiveFailures = 0;
      }
      return res;
    } else {
      if (this.stateVal === "HalfOpen") {
        this.stateVal = "Open";
        this.lastStateChange = Date.now();
        this.consecutiveSuccesses = 0;
        this.halfOpenRequests = 0;
      } else if (this.stateVal === "Closed") {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.failureThreshold) {
          this.stateVal = "Open";
          this.lastStateChange = Date.now();
        }
      }
      return res;
    }
  }

  state(): { kind: "EnumVariant"; enumName: "CircuitState"; variantName: string; payload: unknown[] } {
    return {
      kind: "EnumVariant",
      enumName: "CircuitState",
      variantName: this.stateVal,
      payload: [],
    };
  }

  name(): string {
    return this.nameStr;
  }

  reset(): null {
    this.stateVal = "Closed";
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenRequests = 0;
    this.lastStateChange = Date.now();
    return null;
  }
}

export class FlexRetryPolicy {
  readonly [NATIVE_TAG] = "RetryPolicy";
  private maxAttempts: number;
  private initialDelay: FlexDuration;
  private maxDelay: FlexDuration;
  private backoffMultiplier: number;
  private useJitter: boolean;

  constructor(
    config: any,
    private interpreter: Interpreter,
  ) {
    this.maxAttempts = Math.max(1, getField(config, "max_attempts", 3));
    this.initialDelay = getField(config, "initial_delay", FlexDuration.millis(200));
    this.maxDelay = getField(config, "max_delay", FlexDuration.seconds(2));
    this.backoffMultiplier = getField(config, "backoff_multiplier", 2.0);
    this.useJitter = getField(config, "use_jitter", false);
  }

  async run(fn: unknown): Promise<unknown> {
    const initialMs = this.initialDelay instanceof FlexDuration ? this.initialDelay.millis : 200;
    const maxDelayMs = this.maxDelay instanceof FlexDuration ? this.maxDelay.millis : 2000;
    const mult = this.backoffMultiplier > 0 ? this.backoffMultiplier : 2.0;

    let lastRes: unknown = resultErr("max attempts reached without execution");

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let isError = false;
      try {
        const res = await this.interpreter.callFunction(fn, []);
        if (isResultErr(res)) {
          isError = true;
          lastRes = res;
        } else {
          return res;
        }
      } catch (e: any) {
        isError = true;
        lastRes = resultErr(e.message ?? String(e));
      }

      if (isError && attempt < this.maxAttempts) {
        let delay = initialMs * Math.pow(mult, attempt - 1);
        if (delay > maxDelayMs) {
          delay = maxDelayMs;
        }
        if (this.useJitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, Math.trunc(delay)));
        }
      }
    }

    return lastRes;
  }
}

export class FlexRateLimiter {
  readonly [NATIVE_TAG] = "RateLimiter";
  private ratePerSecond: number;
  private burstCapacity: number;
  private tokenCount: number;
  private lastRefillTime: number;

  constructor(config: any) {
    this.ratePerSecond = getField(config, "rate_per_second", 1);
    this.burstCapacity = getField(config, "burst_capacity", 1);
    this.tokenCount = this.burstCapacity;
    this.lastRefillTime = Date.now();
  }

  allow(): boolean {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    this.tokenCount = Math.min(this.burstCapacity, this.tokenCount + elapsedSeconds * this.ratePerSecond);
    this.lastRefillTime = now;

    if (this.tokenCount >= 1.0) {
      this.tokenCount -= 1.0;
      return true;
    }
    return false;
  }

  tokens(): number {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    return Math.min(this.burstCapacity, this.tokenCount + elapsedSeconds * this.ratePerSecond);
  }

  reset(): null {
    this.tokenCount = this.burstCapacity;
    this.lastRefillTime = Date.now();
    return null;
  }
}

const GO_BOILERPLATE = `// --- FlexLang core/resilience (RFC-038) ---
type CircuitBreakerConfig struct {
	failure_threshold    int
	success_threshold    int
	timeout              *Duration
	half_open_max_requests int
}

type CircuitBreaker struct {
	mu                   sync.Mutex
	name                 string
	config               *CircuitBreakerConfig
	stateVal             CircuitState
	consecutiveFailures  int
	consecutiveSuccesses int
	halfOpenRequests     int
	lastStateChange      time.Time
}

func CircuitBreaker_new(name string, config *CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		name:            name,
		config:          config,
		stateVal:        CircuitState_Closed,
		lastStateChange: time.Now(),
	}
}

func NewCircuitBreaker(name string, config *CircuitBreakerConfig) *CircuitBreaker {
	return CircuitBreaker_new(name, config)
}

func (cb *CircuitBreaker) execute(fn func() Result) Result {
	cb.mu.Lock()
	now := time.Now()
	timeout := 30 * time.Second
	if cb.config != nil && cb.config.timeout != nil {
		timeout = cb.config.timeout.d
	}

	if cb.stateVal == CircuitState_Open {
		if now.Sub(cb.lastStateChange) >= timeout {
			cb.stateVal = CircuitState_HalfOpen
			cb.consecutiveSuccesses = 0
			cb.halfOpenRequests = 0
			cb.lastStateChange = now
		} else {
			cb.mu.Unlock()
			return Result_Err_new("circuit breaker is OPEN")
		}
	}

	if cb.stateVal == CircuitState_HalfOpen {
		if cb.config != nil && cb.config.half_open_max_requests > 0 && cb.halfOpenRequests >= cb.config.half_open_max_requests {
			cb.mu.Unlock()
			return Result_Err_new("circuit breaker is HALF_OPEN (max requests reached)")
		}
		cb.halfOpenRequests++
	}
	cb.mu.Unlock()

	res := fn()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	isErr := false
	if _, ok := res.(Result_Err); ok {
		isErr = true
	}

	if !isErr {
		if cb.stateVal == CircuitState_HalfOpen {
			cb.consecutiveSuccesses++
			if cb.config != nil && cb.consecutiveSuccesses >= cb.config.success_threshold {
				cb.stateVal = CircuitState_Closed
				cb.consecutiveFailures = 0
				cb.consecutiveSuccesses = 0
				cb.halfOpenRequests = 0
				cb.lastStateChange = time.Now()
			}
		} else if cb.stateVal == CircuitState_Closed {
			cb.consecutiveFailures = 0
		}
		return res
	} else {
		if cb.stateVal == CircuitState_HalfOpen {
			cb.stateVal = CircuitState_Open
			cb.lastStateChange = time.Now()
			cb.consecutiveSuccesses = 0
			cb.halfOpenRequests = 0
		} else if cb.stateVal == CircuitState_Closed {
			cb.consecutiveFailures++
			if cb.config != nil && cb.consecutiveFailures >= cb.config.failure_threshold {
				cb.stateVal = CircuitState_Open
				cb.lastStateChange = time.Now()
			}
		}
		return res
	}
}

func (cb *CircuitBreaker) state() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.stateVal
}

func (cb *CircuitBreaker) name_str() string {
	return cb.name
}

func (cb *CircuitBreaker) reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.stateVal = CircuitState_Closed
	cb.consecutiveFailures = 0
	cb.consecutiveSuccesses = 0
	cb.halfOpenRequests = 0
	cb.lastStateChange = time.Now()
}

type RetryConfig struct {
	max_attempts       int
	initial_delay      *Duration
	max_delay          *Duration
	backoff_multiplier float64
	use_jitter         bool
}

type RetryPolicy struct {
	config *RetryConfig
}

func RetryPolicy_new(config *RetryConfig) *RetryPolicy {
	return &RetryPolicy{config: config}
}

func NewRetryPolicy(config *RetryConfig) *RetryPolicy {
	return RetryPolicy_new(config)
}

func (rp *RetryPolicy) run(fn func() Result) Result {
	var lastRes Result = Result_Err_new("max attempts reached without execution")
	initial := 200 * time.Millisecond
	if rp.config != nil && rp.config.initial_delay != nil {
		initial = rp.config.initial_delay.d
	}
	maxD := 2 * time.Second
	if rp.config != nil && rp.config.max_delay != nil {
		maxD = rp.config.max_delay.d
	}
	mult := 2.0
	if rp.config != nil && rp.config.backoff_multiplier > 0 {
		mult = rp.config.backoff_multiplier
	}
	maxAttempts := 1
	if rp.config != nil && rp.config.max_attempts > 0 {
		maxAttempts = rp.config.max_attempts
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		res := fn()
		isErr := false
		if _, ok := res.(Result_Err); ok {
			isErr = true
		}

		if !isErr {
			return res
		}

		lastRes = res
		if attempt < maxAttempts {
			delay := float64(initial) * math.Pow(mult, float64(attempt-1))
			if delay > float64(maxD) {
				delay = float64(maxD)
			}
			if rp.config != nil && rp.config.use_jitter {
				delay = delay * (0.5 + float64(time.Now().UnixNano()%500)/1000.0)
			}
			time.Sleep(time.Duration(delay))
		}
	}
	return lastRes
}

type RateLimiterConfig struct {
	rate_per_second int
	burst_capacity  int
}

type RateLimiter struct {
	mu             sync.Mutex
	ratePerSecond  float64
	burstCapacity  float64
	tokensVal      float64
	lastRefillTime time.Time
}

func RateLimiter_new(config *RateLimiterConfig) *RateLimiter {
	rate := 100.0
	burst := 100.0
	if config != nil {
		rate = float64(config.rate_per_second)
		burst = float64(config.burst_capacity)
	}
	return &RateLimiter{
		ratePerSecond:  rate,
		burstCapacity:  burst,
		tokensVal:      burst,
		lastRefillTime: time.Now(),
	}
}

func NewRateLimiter(config *RateLimiterConfig) *RateLimiter {
	return RateLimiter_new(config)
}

func rate_limiter_new(config *RateLimiterConfig) *RateLimiter {
	return RateLimiter_new(config)
}

func (rl *RateLimiter) allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	elapsed := now.Sub(rl.lastRefillTime).Seconds()
	rl.tokensVal = math.Min(rl.burstCapacity, rl.tokensVal+elapsed*rl.ratePerSecond)
	rl.lastRefillTime = now
	if rl.tokensVal >= 1.0 {
		rl.tokensVal -= 1.0
		return true
	}
	return false
}

func (rl *RateLimiter) remaining_tokens() float64 {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	elapsed := now.Sub(rl.lastRefillTime).Seconds()
	return math.Min(rl.burstCapacity, rl.tokensVal+elapsed*rl.ratePerSecond)
}

func (rl *RateLimiter) tokens() float64 {
	return rl.remaining_tokens()
}

func (rl *RateLimiter) reset() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.tokensVal = rl.burstCapacity
	rl.lastRefillTime = time.Now()
}
// ------------------------------------------`;

export const resilienceModule: NativeModule = {
  path: "core/resilience",

  enums: [
    {
      kind: "EnumDeclaration",
      name: "CircuitState",
      variants: [
        { name: "Closed", payload: [] },
        { name: "Open", payload: [] },
        { name: "HalfOpen", payload: [] },
      ],
    },
  ],

  types: [
    {
      name: "CircuitBreakerConfig",
      properties: [
        { name: "failure_threshold", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "success_threshold", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "half_open_max_requests", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "CircuitBreaker",
      statics: [
        {
          name: "new",
          arity: 2,
          returns: { kind: "Struct", name: "CircuitBreaker", genericArgs: [] },
        },
      ],
      methods: [
        {
          name: "execute",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Any" }, { kind: "String" }],
          },
        },
        {
          name: "state",
          arity: 0,
          returns: { kind: "Enum", name: "CircuitState", genericArgs: [] },
        },
        {
          name: "name",
          arity: 0,
          returns: { kind: "String" },
        },
        {
          name: "is_open",
          arity: 0,
          returns: { kind: "Bool" },
        },
        {
          name: "is_closed",
          arity: 0,
          returns: { kind: "Bool" },
        },
        {
          name: "is_half_open",
          arity: 0,
          returns: { kind: "Bool" },
        },
        {
          name: "reset",
          arity: 0,
          returns: { kind: "Void" },
        },
      ],
      goPointer: true,
    },
    {
      name: "RetryConfig",
      properties: [
        { name: "max_attempts", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "initial_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "max_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "backoff_multiplier", typeAnnotation: { kind: "NamedTypeNode", name: "Float" } },
        { name: "use_jitter", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
      ],
    },
    {
      name: "RetryPolicyConfig",
      properties: [
        { name: "max_attempts", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "initial_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "max_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "backoff_multiplier", typeAnnotation: { kind: "NamedTypeNode", name: "Float" } },
        { name: "use_jitter", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
      ],
    },
    {
      name: "RetryPolicy",
      statics: [
        {
          name: "new",
          arity: 1,
          returns: { kind: "Struct", name: "RetryPolicy", genericArgs: [] },
        },
      ],
      methods: [
        {
          name: "execute",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Any" }, { kind: "String" }],
          },
        },
        {
          name: "run",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Any" }, { kind: "String" }],
          },
        },
      ],
      goPointer: true,
    },
    {
      name: "RateLimiterConfig",
      properties: [
        { name: "rate_per_second", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "burst_capacity", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "RateLimiter",
      statics: [
        {
          name: "new",
          arity: 1,
          returns: { kind: "Struct", name: "RateLimiter", genericArgs: [] },
        },
      ],
      methods: [
        {
          name: "allow",
          arity: 0,
          returns: { kind: "Bool" },
        },
        {
          name: "remaining_tokens",
          arity: 0,
          returns: { kind: "Float" },
        },
        {
          name: "tokens",
          arity: 0,
          returns: { kind: "Float" },
        },
        {
          name: "reset",
          arity: 0,
          returns: { kind: "Void" },
        },
      ],
      goPointer: true,
    },
    {
      name: "resilience",
      statics: [
        {
          name: "circuit_breaker",
          arity: 2,
          returns: { kind: "Struct", name: "CircuitBreaker", genericArgs: [] },
        },
        {
          name: "retry",
          arity: 1,
          returns: { kind: "Struct", name: "RetryPolicy", genericArgs: [] },
        },
        {
          name: "rate_limiter",
          arity: 1,
          returns: { kind: "Struct", name: "RateLimiter", genericArgs: [] },
        },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (interpreter: Interpreter) => {
    return {
      CircuitState: {
        Closed: "Closed",
        Open: "Open",
        HalfOpen: "HalfOpen",
      },
      CircuitBreakerConfig: {
        kind: "StructDeclaration",
        name: "CircuitBreakerConfig",
        properties: [
          { name: "failure_threshold", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
          { name: "success_threshold", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
          { name: "timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
          { name: "half_open_max_requests", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        ],
      },
      CircuitBreaker: {
        [NATIVE_TAG]: "CircuitBreaker",
        new: (name: string, config: any) => new FlexCircuitBreaker(name, config, interpreter),
      },
      RetryConfig: {
        kind: "StructDeclaration",
        name: "RetryConfig",
        properties: [
          { name: "max_attempts", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
          { name: "initial_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
          { name: "max_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
          { name: "backoff_multiplier", typeAnnotation: { kind: "NamedTypeNode", name: "Float" } },
          { name: "use_jitter", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
        ],
      },
      RetryPolicyConfig: {
        kind: "StructDeclaration",
        name: "RetryPolicyConfig",
        properties: [
          { name: "max_attempts", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
          { name: "initial_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
          { name: "max_delay", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
          { name: "backoff_multiplier", typeAnnotation: { kind: "NamedTypeNode", name: "Float" } },
          { name: "use_jitter", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
        ],
      },
      RetryPolicy: {
        [NATIVE_TAG]: "RetryPolicy",
        new: (config: any) => new FlexRetryPolicy(config, interpreter),
      },
      RateLimiterConfig: {
        kind: "StructDeclaration",
        name: "RateLimiterConfig",
        properties: [
          { name: "rate_per_second", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
          { name: "burst_capacity", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        ],
      },
      RateLimiter: {
        [NATIVE_TAG]: "RateLimiter",
        new: (config: any) => new FlexRateLimiter(config),
      },
      resilience: {
        [NATIVE_TAG]: "resilience",
        circuit_breaker: (name: string, config: any) => new FlexCircuitBreaker(name, config, interpreter),
        retry: (config: any) => new FlexRetryPolicy(config, interpreter),
        rate_limiter: (config: any) => new FlexRateLimiter(config),
      },
    };
  },

  goCodegen: {
    imports: ["math", "sync", "time"],
    boilerplate: GO_BOILERPLATE,
  },
};
