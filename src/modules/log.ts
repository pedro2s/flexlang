import { NATIVE_TAG, type NativeModule } from "./types";

const GO_BOILERPLATE = `
// --- FlexLang Log Boilerplate (RFC-008) ---
func log_info(msg string, fields map[string]any) {
	entry := map[string]any{
		"level": "info",
		"msg":   msg,
		"ts":    time.Now().Format(time.RFC3339),
	}
	for k, v := range fields {
		entry[k] = v
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
		entry[k] = v
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
          const entry = {
            level: "info",
            msg,
            ts: new Date().toISOString(),
            ...Object.fromEntries(fields),
          };
          console.log(JSON.stringify(entry));
        },
        error: (msg: string, fields: Map<string, any>) => {
          const entry = {
            level: "error",
            msg,
            ts: new Date().toISOString(),
            ...Object.fromEntries(fields),
          };
          console.log(JSON.stringify(entry));
        },
      },
    };
  },
  goCodegen: {
    imports: ["encoding/json", "fmt", "time"],
    boilerplate: GO_BOILERPLATE,
  },
};
