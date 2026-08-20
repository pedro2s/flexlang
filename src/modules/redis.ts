import { Redis as IORedis } from "ioredis";
import { optionNone, optionSome, resultErr, resultOk } from "../stdlib";
import { NATIVE_TAG, type NativeModule } from "./types";
import { randomBytes } from "crypto";

class FlexRedisLock {
  readonly [NATIVE_TAG] = "RedisLock";

  constructor(
    private client: IORedis,
    private lockKey: string,
    private token: string,
  ) {}

  async release(): Promise<unknown> {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await this.client.eval(luaScript, 1, this.lockKey, this.token);
      return resultOk(null);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }
}

class FlexRedis {
  readonly [NATIVE_TAG] = "Redis";

  constructor(private client: IORedis) {}

  async set_ex(key: string, value: string, duration: any): Promise<unknown> {
    try {
      const ms = duration.as_millis();
      await this.client.set(key, value, "PX", ms);
      return resultOk(null);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async get(key: string): Promise<unknown> {
    try {
      const val = await this.client.get(key);
      if (val === null) {
        return resultOk(optionNone());
      }
      return resultOk(optionSome(val));
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async del(key: string): Promise<unknown> {
    try {
      await this.client.del(key);
      return resultOk(null);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async incr(key: string): Promise<unknown> {
    try {
      const val = await this.client.incr(key);
      return resultOk(val);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async expire(key: string, duration: any): Promise<unknown> {
    try {
      const ms = duration.as_millis();
      const seconds = Math.max(1, Math.floor(ms / 1000));
      await this.client.expire(key, seconds);
      return resultOk(null);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async acquire_lock(key: string, duration: any): Promise<unknown> {
    try {
      const ms = duration.as_millis();
      const token = randomBytes(16).toString("hex");
      const res = await this.client.set(key, token, "PX", ms, "NX");
      if (res === "OK") {
        return resultOk(new FlexRedisLock(this.client, key, token));
      }
      return resultErr("lock acquisition failed (already locked)");
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }
}

const GO_BOILERPLATE = `
// --- FlexLang db/redis Boilerplate (RFC-036) ---
var releaseLuaScript = redis.NewScript(\`
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
else
	return 0
end
\`)

type RedisLock struct {
	client  *redis.Client
	lockKey string
	token   string
}

func (l *RedisLock) release() Result {
	ctx := context.Background()
	_, err := releaseLuaScript.Run(ctx, l.client, []string{l.lockKey}, l.token).Result()
	if err != nil {
		return Result_Err_new(err.Error())
	}
	return Result_Ok_new(nil)
}

type RedisConfig struct {
	host            string
	port            int
	password        Option
	db              int
	max_pool_size   int
	connect_timeout *Duration
}

type Redis struct {
	client *redis.Client
}

func Redis_connect(config *RedisConfig) Result {
	if config.max_pool_size <= 0 {
		config.max_pool_size = 10
	}

	passStr := ""
	if passOpt, ok := config.password.(Option_Some); ok {
		passStr, _ = passOpt.Field0.(string)
	}

	addr := fmt.Sprintf("%s:%d", config.host, config.port)

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: passStr,
		DB:       config.db,
		PoolSize: config.max_pool_size,
	})

	ctx := context.Background()
	if _, err := client.Ping(ctx).Result(); err != nil {
		return Result_Err_new(err.Error())
	}

	return Result_Ok_new(&Redis{client: client})
}

func (r *Redis) set_ex(key string, value string, duration *Duration) Result {
	ctx := context.Background()
	err := r.client.Set(ctx, key, value, time.Duration(duration.as_millis())*time.Millisecond).Err()
	if err != nil {
		return Result_Err_new(err.Error())
	}
	return Result_Ok_new(nil)
}

func (r *Redis) get(key string) Result {
	ctx := context.Background()
	val, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return Result_Ok_new(Option_None)
	} else if err != nil {
		return Result_Err_new(err.Error())
	}
	return Result_Ok_new(Option_Some_new(val))
}

func (r *Redis) del(key string) Result {
	ctx := context.Background()
	err := r.client.Del(ctx, key).Err()
	if err != nil {
		return Result_Err_new(err.Error())
	}
	return Result_Ok_new(nil)
}

func (r *Redis) incr(key string) Result {
	ctx := context.Background()
	val, err := r.client.Incr(ctx, key).Result()
	if err != nil {
		return Result_Err_new(err.Error())
	}
	return Result_Ok_new(int(val))
}

func (r *Redis) expire(key string, duration *Duration) Result {
	ctx := context.Background()
	err := r.client.Expire(ctx, key, time.Duration(duration.as_millis())*time.Millisecond).Err()
	if err != nil {
		return Result_Err_new(err.Error())
	}
	return Result_Ok_new(nil)
}

func (r *Redis) acquire_lock(key string, duration *Duration) Result {
	ctx := context.Background()
	token := make([]byte, 16)
	rand.Read(token)
	tokenStr := fmt.Sprintf("%x", token)

	ok, err := r.client.SetNX(ctx, key, tokenStr, time.Duration(duration.as_millis())*time.Millisecond).Result()
	if err != nil {
		return Result_Err_new(err.Error())
	}
	if !ok {
		return Result_Err_new("lock acquisition failed (already locked)")
	}

	lock := &RedisLock{
		client:  r.client,
		lockKey: key,
		token:   tokenStr,
	}
	return Result_Ok_new(lock)
}
// ---------------------------------
`;

export const redisModule: NativeModule = {
  path: "db/redis",

  types: [
    {
      name: "RedisConfig",
      fields: [
        { name: "host", type: { kind: "String" } },
        { name: "port", type: { kind: "Int" } },
        { name: "password", type: { kind: "Enum", name: "Option", genericArgs: [{ kind: "String" }] } },
        { name: "db", type: { kind: "Int" } },
        { name: "max_pool_size", type: { kind: "Int" } },
        { name: "connect_timeout", type: { kind: "Struct", name: "Duration", genericArgs: [] } },
      ],
    },
    {
      name: "RedisLock",
      goPointer: true,
      methods: [
        { name: "release", arity: 0, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] } },
      ],
    },
    {
      name: "Redis",
      goPointer: true,
      statics: [
        {
          name: "connect",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Struct", name: "Redis", genericArgs: [] }, { kind: "String" }],
          },
        },
      ],
      methods: [
        {
          name: "set_ex",
          arity: 3,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] },
        },
        {
          name: "get",
          arity: 1,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Enum", name: "Option", genericArgs: [{ kind: "String" }] }, { kind: "String" }] },
        },
        {
          name: "del",
          arity: 1,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] },
        },
        {
          name: "incr",
          arity: 1,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Int" }, { kind: "String" }] },
        },
        {
          name: "expire",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] },
        },
        {
          name: "acquire_lock",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "RedisLock", genericArgs: [] }, { kind: "String" }] },
        },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: () => ({
    RedisConfig: { kind: "StructDeclaration" },
    RedisLock: { kind: "StructDeclaration" },
    Redis: {
      [NATIVE_TAG]: "Redis",
      connect: async (config: Map<string, any>) => {
        try {
          const host = config.get("host") || "127.0.0.1";
          const port = config.get("port") || 6379;
          const db = config.get("db") || 0;
          let password = undefined;
          
          const passOpt = config.get("password");
          if (passOpt !== null && typeof passOpt === "object" && passOpt.variantName === "Some") {
            password = passOpt.payload[0];
          }

          // Convertendo o timeout (Duration) em ms nativo do NodeJS se existir.
          const ct = config.get("connect_timeout");
          const connectTimeout = ct ? ct.as_millis() : 10000;

          const client = new IORedis({
            host,
            port,
            db,
            password,
            connectTimeout,
            maxRetriesPerRequest: 1, // Fail fast se o Redis não estiver no ar
          });

          // Pinging to ensure connection is actually established right away
          await client.ping();
          return resultOk(new FlexRedis(client));
        } catch (e: any) {
          return resultErr(e.message ?? String(e));
        }
      },
    },
  }),

  goCodegen: {
    imports: ["context", "fmt", "time", "crypto/rand", "github.com/redis/go-redis/v9"],
    boilerplate: GO_BOILERPLATE,
  },
};
