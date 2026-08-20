import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";
import * as fs from "fs";

function parseDotenvTS(content: string): Map<string, string> {
  const m = new Map<string, string>();
  for (let line of content.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    
    val = val.replace(/\$\{?([a-zA-Z0-9_]+)\}?/g, (_, varName) => {
      return m.get(varName) || process.env[varName] || "";
    });
    
    m.set(key, val);
  }
  return m;
}

function injectTS(path: string, override: boolean): any {
  try {
    const content = fs.readFileSync(path, "utf-8");
    const parsed = parseDotenvTS(content);
    for (const [k, v] of parsed) {
      if (!override && process.env[k] !== undefined) continue;
      process.env[k] = v;
    }
    return resultOk(null); // Nil payload
  } catch(e: any) {
    return resultErr(e.message || String(e));
  }
}

const GO_BOILERPLATE = `// --- FlexLang config/dotenv ---
type DotenvConfig struct {
    path     string
    override bool
    debug    bool
}

func parseDotenv(content string) map[string]string {
    lines := strings.Split(content, "\\n")
    m := make(map[string]string)
    
    re := regexp.MustCompile(\`\\$\\{?([a-zA-Z0-9_]+)\\}?\`)
    
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if len(line) == 0 || strings.HasPrefix(line, "#") { continue }
        
        parts := strings.SplitN(line, "=", 2)
        if len(parts) != 2 { continue }
        
        key := strings.TrimSpace(parts[0])
        val := strings.TrimSpace(parts[1])
        
        if (strings.HasPrefix(val, "\\"") && strings.HasSuffix(val, "\\"")) || (strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
            val = val[1 : len(val)-1]
        }
        
        val = re.ReplaceAllStringFunc(val, func(match string) string {
            subs := re.FindStringSubmatch(match)
            if len(subs) < 2 { return "" }
            varName := subs[1]
            if v, ok := m[varName]; ok { return v }
            if v, ok := os.LookupEnv(varName); ok { return v }
            return ""
        })
        
        m[key] = val
    }
    return m
}

func dotenv_parse(content string) map[string]any {
    m := parseDotenv(content)
    res := make(map[string]any)
    for k, v := range m { res[k] = v }
    return res
}

func dotenvInject(path string, override bool) Result {
    b, err := os.ReadFile(path)
    if err != nil { return Result_Err_new(err.Error()) }
    
    m := parseDotenv(string(b))
    for k, v := range m {
        if !override {
            if _, exists := os.LookupEnv(k); exists { continue }
        }
        os.Setenv(k, v)
    }
    return Result_Ok_new(nil)
}

func dotenv_load() Result { return dotenvInject(".env", false) }
func dotenv_load_file(path string) Result { return dotenvInject(path, false) }
func dotenv_load_with(cfg *DotenvConfig) Result {
    p := ".env"
    if cfg != nil && cfg.path != "" { p = cfg.path }
    ov := false
    if cfg != nil { ov = cfg.override }
    return dotenvInject(p, ov)
}
// -----------------------`;

export const dotenvModule: NativeModule = {
  path: "config/dotenv",

  types: [
    {
      name: "dotenv",
      statics: [
        { name: "load", arity: 0, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] } },
        { name: "load_file", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] } },
        { name: "load_with", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] } },
        { name: "parse", arity: 1, returns: { kind: "Map" } },
      ],
      methods: [],
    },
    {
      name: "DotenvConfig",
      properties: [
        { name: "path", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "override", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
        { name: "debug", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
      ],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: (interpreter) => ({
    dotenv: {
      [NATIVE_TAG]: "dotenv",
      load: () => injectTS(".env", false),
      load_file: (path: string) => injectTS(path, false),
      load_with: (cfg?: Map<string, unknown>) => {
        const p = (cfg?.get("path") as string) || ".env";
        const ov = (cfg?.get("override") as boolean) || false;
        return injectTS(p, ov);
      },
      parse: (content: string) => {
        // Conversão de Map<string, string> para Map<string, any> (exigência do TS runtime da flexlang)
        const parsed = parseDotenvTS(content);
        const res = new Map<string, any>();
        for (const [k, v] of parsed) res.set(k, v);
        return res;
      },
    },
    DotenvConfig: {
      kind: "StructDeclaration",
      name: "DotenvConfig",
      properties: [
        { name: "path", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "override", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
        { name: "debug", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
      ],
    },
  }),

  goCodegen: {
    imports: ["os", "strings", "regexp"],
    boilerplate: GO_BOILERPLATE,
  },
};
