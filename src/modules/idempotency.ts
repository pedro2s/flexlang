import { NATIVE_TAG, type NativeModule } from "./types";
import { optionNone, optionSome, resultErr, resultOk } from "../stdlib";
import type { Interpreter } from "../interpreter";
import { FlexDuration } from "./time";

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

function toMap(obj: any): Map<string, string> {
  const m = new Map<string, string>();
  if (!obj) return m;
  if (obj instanceof Map) {
    for (const [k, v] of obj.entries()) {
      if (k !== undefined && v !== undefined) {
        m.set(String(k), String(v));
      }
    }
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        m.set(String(k), String(v));
      }
    }
  }
  return m;
}

export interface StoredEntry {
  state: "PROCESSING" | "COMPLETED";
  cached?: {
    status: number;
    body: any;
    headers: Map<string, string>;
  };
  expiresAt: number;
  lockToken?: string;
}

export class FlexIdempotencyLock {
  readonly [NATIVE_TAG] = "IdempotencyLock";

  constructor(
    private key: string,
    private engine: FlexIdempotencyEngine,
    private isReleased = false,
  ) {}

  release(): unknown {
    if (this.isReleased) {
      return resultOk(null);
    }
    this.isReleased = true;
    return this.engine.releaseLock(this.key);
  }
}

export class FlexIdempotencyEngine {
  readonly [NATIVE_TAG] = "IdempotencyEngine";
  private storage: any;
  private ttlMillis: number;
  private headerName: string;
  private lockTimeoutMillis: number;

  private memoryStore = new Map<string, StoredEntry>();

  constructor(config: any) {
    this.storage = getField(config, "storage", null);
    const ttl = getField(config, "ttl", FlexDuration.hours(24));
    this.ttlMillis = typeof ttl?.as_millis === "function" ? ttl.as_millis() : 24 * 60 * 60 * 1000;
    this.headerName = getField(config, "header_name", "Idempotency-Key");
    const lockTimeout = getField(config, "lock_timeout", FlexDuration.seconds(30));
    this.lockTimeoutMillis = typeof lockTimeout?.as_millis === "function" ? lockTimeout.as_millis() : 30 * 1000;
  }

  check(key: string): unknown {
    if (!key || key.trim().length === 0) {
      return resultErr("idempotency key cannot be empty");
    }

    const now = Date.now();
    const entry = this.memoryStore.get(key);

    if (!entry) {
      return resultOk(optionNone());
    }

    if (entry.expiresAt <= now) {
      this.memoryStore.delete(key);
      return resultOk(optionNone());
    }

    if (entry.state === "PROCESSING") {
      return resultErr("TRANSACTION_IN_PROGRESS: Idempotency key is currently being processed");
    }

    if (entry.state === "COMPLETED" && entry.cached) {
      const respMap = new Map<string, unknown>();
      respMap.set("status", entry.cached.status);
      respMap.set("body", entry.cached.body);
      respMap.set("headers", entry.cached.headers);
      return resultOk(optionSome(respMap));
    }

    return resultOk(optionNone());
  }

  start_processing(key: string, timeout?: any): unknown {
    if (!key || key.trim().length === 0) {
      return resultErr("idempotency key cannot be empty");
    }

    const now = Date.now();
    const entry = this.memoryStore.get(key);

    if (entry && entry.expiresAt > now) {
      if (entry.state === "PROCESSING") {
        return resultErr("TRANSACTION_IN_PROGRESS: Idempotency key is already locked or in progress");
      }
      if (entry.state === "COMPLETED") {
        return resultErr("TRANSACTION_ALREADY_COMPLETED: Idempotency key has already been executed");
      }
    }

    let lockMs = this.lockTimeoutMillis;
    if (timeout && typeof timeout.as_millis === "function") {
      lockMs = timeout.as_millis();
    }

    this.memoryStore.set(key, {
      state: "PROCESSING",
      expiresAt: now + lockMs,
    });

    return resultOk(new FlexIdempotencyLock(key, this));
  }

  save_completed(key: string, status: number, body: any, headers?: any): unknown {
    if (!key || key.trim().length === 0) {
      return resultErr("idempotency key cannot be empty");
    }

    const now = Date.now();
    const headersMap = toMap(headers);

    this.memoryStore.set(key, {
      state: "COMPLETED",
      cached: {
        status,
        body,
        headers: headersMap,
      },
      expiresAt: now + this.ttlMillis,
    });

    return resultOk(null);
  }

  releaseLock(key: string): unknown {
    const entry = this.memoryStore.get(key);
    if (entry && entry.state === "PROCESSING") {
      this.memoryStore.delete(key);
    }
    return resultOk(null);
  }

  clear(key: string): unknown {
    this.memoryStore.delete(key);
    return resultOk(null);
  }
}

const GO_BOILERPLATE = `// --- FlexLang finance/idempotency (RFC-042) ---
type IdempotencyConfig struct {
	storage      any
	ttl          *Duration
	header_name  string
	lock_timeout *Duration
}

type CachedResponse struct {
	status  int
	body    any
	headers any
}

type idempotencyEntry struct {
	state     string // "PROCESSING" ou "COMPLETED"
	status    int
	body      any
	headers   any
	expiresAt time.Time
}

type IdempotencyEngine struct {
	mu          sync.RWMutex
	config      *IdempotencyConfig
	entries     map[string]*idempotencyEntry
	ttl         time.Duration
	lockTimeout time.Duration
}

type IdempotencyLock struct {
	key        string
	engine     *IdempotencyEngine
	isReleased bool
	mu         sync.Mutex
}

func IdempotencyEngine_new(config *IdempotencyConfig) Result {
	ttl := 24 * time.Hour
	if config != nil && config.ttl != nil {
		ttl = time.Duration(config.ttl.as_millis()) * time.Millisecond
	}
	lockTimeout := 30 * time.Second
	if config != nil && config.lock_timeout != nil {
		lockTimeout = time.Duration(config.lock_timeout.as_millis()) * time.Millisecond
	}

	return Result_Ok_new(&IdempotencyEngine{
		config:      config,
		entries:     make(map[string]*idempotencyEntry),
		ttl:         ttl,
		lockTimeout: lockTimeout,
	})
}

func NewIdempotencyEngine(config *IdempotencyConfig) Result {
	return IdempotencyEngine_new(config)
}

func (e *IdempotencyEngine) check(key string) Result {
	e.mu.Lock()
	defer e.mu.Unlock()

	if len(key) == 0 {
		return Result_Err_new("idempotency key cannot be empty")
	}

	now := time.Now()
	entry, ok := e.entries[key]
	if !ok {
		return Result_Ok_new(Option_None)
	}

	if now.After(entry.expiresAt) {
		delete(e.entries, key)
		return Result_Ok_new(Option_None)
	}

	if entry.state == "PROCESSING" {
		return Result_Err_new("TRANSACTION_IN_PROGRESS: Idempotency key is currently being processed")
	}

	if entry.state == "COMPLETED" {
		cached := &CachedResponse{
			status:  entry.status,
			body:    entry.body,
			headers: entry.headers,
		}
		return Result_Ok_new(Option_Some_new(cached))
	}

	return Result_Ok_new(Option_None)
}

func (e *IdempotencyEngine) start_processing(key string, args ...*Duration) Result {
	e.mu.Lock()
	defer e.mu.Unlock()

	if len(key) == 0 {
		return Result_Err_new("idempotency key cannot be empty")
	}

	now := time.Now()
	entry, ok := e.entries[key]
	if ok && now.Before(entry.expiresAt) {
		if entry.state == "PROCESSING" {
			return Result_Err_new("TRANSACTION_IN_PROGRESS: Idempotency key is already locked or in progress")
		}
		if entry.state == "COMPLETED" {
			return Result_Err_new("TRANSACTION_ALREADY_COMPLETED: Idempotency key has already been executed")
		}
	}

	lockDur := e.lockTimeout
	if len(args) > 0 && args[0] != nil {
		lockDur = time.Duration(args[0].as_millis()) * time.Millisecond
	}

	e.entries[key] = &idempotencyEntry{
		state:     "PROCESSING",
		expiresAt: now.Add(lockDur),
	}

	lock := &IdempotencyLock{
		key:    key,
		engine: e,
	}
	return Result_Ok_new(lock)
}

func (e *IdempotencyEngine) save_completed(key string, status int, body any, args ...any) Result {
	e.mu.Lock()
	defer e.mu.Unlock()

	if len(key) == 0 {
		return Result_Err_new("idempotency key cannot be empty")
	}

	now := time.Now()
	var headers any
	if len(args) > 0 {
		headers = args[0]
	}

	e.entries[key] = &idempotencyEntry{
		state:     "COMPLETED",
		status:    status,
		body:      body,
		headers:   headers,
		expiresAt: now.Add(e.ttl),
	}

	return Result_Ok_new(nil)
}

func (e *IdempotencyEngine) releaseLock(key string) Result {
	e.mu.Lock()
	defer e.mu.Unlock()

	entry, ok := e.entries[key]
	if ok && entry.state == "PROCESSING" {
		delete(e.entries, key)
	}
	return Result_Ok_new(nil)
}

func (e *IdempotencyEngine) clear(key string) Result {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.entries, key)
	return Result_Ok_new(nil)
}

func (l *IdempotencyLock) release() Result {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.isReleased {
		return Result_Ok_new(nil)
	}
	l.isReleased = true
	return l.engine.releaseLock(l.key)
}
// ---------------------------------------------`;

export const idempotencyModule: NativeModule = {
  path: "finance/idempotency",

  types: [
    {
      name: "IdempotencyConfig",
      goPointer: true,
      properties: [
        { name: "storage", typeAnnotation: { kind: "NamedTypeNode", name: "Any" } },
        { name: "ttl", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "header_name", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "lock_timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
      ],
    },
    {
      name: "CachedResponse",
      goPointer: true,
      properties: [
        { name: "status", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "body", typeAnnotation: { kind: "NamedTypeNode", name: "Any" } },
        {
          name: "headers",
          typeAnnotation: {
            kind: "HashMapTypeNode",
            keyType: { kind: "NamedTypeNode", name: "String" },
            valueType: { kind: "NamedTypeNode", name: "String" },
          },
        },
      ],
    },
    {
      name: "IdempotencyLock",
      goPointer: true,
      methods: [
        {
          name: "release",
          arity: 0,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
      ],
    },
    {
      name: "IdempotencyEngine",
      goPointer: true,
      statics: [
        {
          name: "new",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Struct", name: "IdempotencyEngine", genericArgs: [] },
              { kind: "String" },
            ],
          },
        },
      ],
      methods: [
        {
          name: "check",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              {
                kind: "Enum",
                name: "Option",
                genericArgs: [{ kind: "Struct", name: "CachedResponse", genericArgs: [] }],
              },
              { kind: "String" },
            ],
          },
        },
        {
          name: "start_processing",
          minArity: 1,
          maxArity: 2,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Struct", name: "IdempotencyLock", genericArgs: [] },
              { kind: "String" },
            ],
          },
        },
        {
          name: "save_completed",
          minArity: 3,
          maxArity: 4,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
        {
          name: "clear",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Void" }, { kind: "String" }],
          },
        },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (_interpreter: Interpreter) => ({
    IdempotencyConfig: {
      kind: "StructDeclaration",
      name: "IdempotencyConfig",
      properties: [
        { name: "storage", typeAnnotation: { kind: "NamedTypeNode", name: "Any" } },
        { name: "ttl", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
        { name: "header_name", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "lock_timeout", typeAnnotation: { kind: "NamedTypeNode", name: "Duration" } },
      ],
    },
    CachedResponse: {
      kind: "StructDeclaration",
      name: "CachedResponse",
      properties: [
        { name: "status", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "body", typeAnnotation: { kind: "NamedTypeNode", name: "Any" } },
        {
          name: "headers",
          typeAnnotation: {
            kind: "HashMapTypeNode",
            keyType: { kind: "NamedTypeNode", name: "String" },
            valueType: { kind: "NamedTypeNode", name: "String" },
          },
        },
      ],
    },
    IdempotencyLock: {
      [NATIVE_TAG]: "IdempotencyLock",
    },
    IdempotencyEngine: {
      [NATIVE_TAG]: "IdempotencyEngine",
      new: (config: any) => {
        return resultOk(new FlexIdempotencyEngine(config));
      },
    },
  }),

  goCodegen: {
    imports: ["sync", "time"],
    boilerplate: GO_BOILERPLATE,
  },
};
