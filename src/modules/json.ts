import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";

const GO_BOILERPLATE = `// --- FlexLang encoding/json ---
func json_parse(jsonStr string) Result {
    var m map[string]any
    err := json.Unmarshal([]byte(jsonStr), &m)
    if err != nil {
        return Result_Err_new("JSON Parse Error: " + err.Error())
    }
    return Result_Ok_new(m)
}

func json_stringify(payload any) Result {
    b, err := json.Marshal(payload)
    if err != nil {
        return Result_Err_new("JSON Stringify Error: " + err.Error())
    }
    return Result_Ok_new(string(b))
}

func json_stringify_pretty(payload any, indent int) Result {
    indentStr := strings.Repeat(" ", indent)
    b, err := json.MarshalIndent(payload, "", indentStr)
    if err != nil {
        return Result_Err_new("JSON Stringify Error: " + err.Error())
    }
    return Result_Ok_new(string(b))
}

func json_get(m any, key string) Option {
    switch mv := m.(type) {
    case map[string]any:
        if v, ok := mv[key]; ok {
            return Option_Some_new(v)
        }
    }
    return Option_None
}

func json_set(m any, key string, val any) {
    switch mv := m.(type) {
    case map[string]any:
        mv[key] = val
    }
}
// -----------------------------`;

function jsToFlex(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(jsToFlex);
  if (typeof obj === "object") {
    const m = new Map<string, any>();
    for (const k of Object.keys(obj)) {
      m.set(k, jsToFlex(obj[k]));
    }
    return m;
  }
  return obj;
}

function flexToJs(val: any): any {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map(flexToJs);
  if (val instanceof Map) {
    const obj: any = {};
    for (const [k, v] of val) {
      obj[k] = flexToJs(v);
    }
    return obj;
  }
  // Suporte a primitivos e structs caso existam objetos não-Map no runtime
  if (typeof val === "object" && !(val instanceof Map)) {
    const obj: any = {};
    for (const k of Object.keys(val)) {
      obj[k] = flexToJs(val[k]);
    }
    return obj;
  }
  return val;
}

export const jsonModule: NativeModule = {
  path: "encoding/json",

  types: [
    {
      name: "json",
      statics: [
        { name: "parse", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Map" }, { kind: "String" }] } },
        { name: "stringify", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "String" }, { kind: "String" }] } },
        { name: "stringify_pretty", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "String" }, { kind: "String" }] } },
        { name: "get", arity: 2, returns: { kind: "Enum", name: "Option", genericArgs: [{ kind: "Any" }] } },
        { name: "set", arity: 3, returns: { kind: "Void" } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (interpreter) => ({
    json: {
      [NATIVE_TAG]: "json",
      parse: (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (typeof parsed !== "object" || parsed === null) {
              return resultErr("JSON Parse Error: Root must be an object or array");
          }
          return resultOk(jsToFlex(parsed));
        } catch (e: any) {
          return resultErr("JSON Parse Error: " + (e.message || String(e)));
        }
      },
      stringify: (payload: any) => {
        try {
          const jsObj = flexToJs(payload);
          return resultOk(JSON.stringify(jsObj));
        } catch (e: any) {
          return resultErr("JSON Stringify Error: " + (e.message || String(e)));
        }
      },
      stringify_pretty: (payload: any, indent: number) => {
        try {
          const jsObj = flexToJs(payload);
          return resultOk(JSON.stringify(jsObj, null, indent));
        } catch (e: any) {
          return resultErr("JSON Stringify Error: " + (e.message || String(e)));
        }
      },
      get: (m: any, key: string) => {
        if (m instanceof Map && m.has(key)) return { kind: "Option_Some", value: m.get(key) };
        return { kind: "Option_None" };
      },
      set: (m: any, key: string, val: any) => {
        if (m instanceof Map) m.set(key, val);
      },
    }
  }),

  goCodegen: {
    imports: ["encoding/json", "strings"],
    boilerplate: GO_BOILERPLATE,
  },
};
