import { NATIVE_TAG, type NativeModule } from "./types";

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "api_key",
]);

function maskAndConvert(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      const keyStr = String(k);
      if (SENSITIVE_KEYS.has(keyStr.toLowerCase())) {
        obj[keyStr] = "***";
      } else {
        obj[keyStr] = maskAndConvert(v);
      }
    }
    return obj;
  }
  if (Array.isArray(value)) {
    return value.map(maskAndConvert);
  }
  if (value !== null && typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        obj[k] = "***";
      } else {
        obj[k] = maskAndConvert(v);
      }
    }
    return obj;
  }
  return value;
}

const GO_BOILERPLATE = `
// --- FlexLang Log Boilerplate (RFC-008, RFC-009) ---
var sensitiveLogKeys = map[string]bool{
	"password":      true,
	"secret":        true,
	"token":         true,
	"authorization": true,
	"api_key":       true,
}

func maskSensitiveLogFields(data any) any {
	switch v := data.(type) {
	case map[string]any:
		masked := make(map[string]any, len(v))
		for k, val := range v {
			if sensitiveLogKeys[strings.ToLower(k)] {
				masked[k] = "***"
			} else {
				masked[k] = maskSensitiveLogFields(val)
			}
		}
		return masked
	case []any:
		masked := make([]any, len(v))
		for i, item := range v {
			masked[i] = maskSensitiveLogFields(item)
		}
		return masked
	default:
		return data
	}
}

func log_info(msg string, fields map[string]any) {
	entry := map[string]any{
		"level": "info",
		"msg":   msg,
		"ts":    time.Now().Format(time.RFC3339),
	}
	for k, v := range fields {
		if sensitiveLogKeys[strings.ToLower(k)] {
			entry[k] = "***"
		} else {
			entry[k] = maskSensitiveLogFields(v)
		}
	}
	out, _ := json.Marshal(entry)
	fmt.Println(string(out))
}

func log_error(msg string, fields map[string]any) {
	entry := map[string]any{
		"level": "error",
		"msg":   msg,
		"ts":    time.Now().Format(time.RFC3339),
	}
	for k, v := range fields {
		if sensitiveLogKeys[strings.ToLower(k)] {
			entry[k] = "***"
		} else {
			entry[k] = maskSensitiveLogFields(v)
		}
	}
	out, _ := json.Marshal(entry)
	fmt.Println(string(out))
}
// ---------------------------------
`;

export const logModule: NativeModule = {
  path: "core/log",
  types: [
    {
      name: "log",
      statics: [
        { name: "info", arity: 2, returns: { kind: "Void" } },
        { name: "error", arity: 2, returns: { kind: "Void" } },
      ],
    },
  ],
  usesBuiltins: [],
  runtimeBinding: (interpreter) => {
    return {
      log: {
        [NATIVE_TAG]: "log",
        info: (msg: string, fields: Map<string, any>) => {
          const masked = maskAndConvert(fields) as Record<string, unknown>;
          const entry = {
            level: "info",
            msg,
            ts: new Date().toISOString(),
            ...masked,
          };
          console.log(JSON.stringify(entry));
        },
        error: (msg: string, fields: Map<string, any>) => {
          const masked = maskAndConvert(fields) as Record<string, unknown>;
          const entry = {
            level: "error",
            msg,
            ts: new Date().toISOString(),
            ...masked,
          };
          console.log(JSON.stringify(entry));
        },
      },
    };
  },
  goCodegen: {
    imports: ["encoding/json", "fmt", "time", "strings"],
    boilerplate: GO_BOILERPLATE,
  },
};
