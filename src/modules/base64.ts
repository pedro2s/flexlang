import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";

const GO_BOILERPLATE = `// --- FlexLang encoding/base64 ---
func base64_encode(payload string) string {
    return base64.StdEncoding.EncodeToString([]byte(payload))
}

func base64_decode(b64Str string) Result {
    b, err := base64.StdEncoding.DecodeString(b64Str)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new(string(b))
}

func base64_encode_url_safe(payload string) string {
    return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func base64_decode_url_safe(b64Str string) Result {
    b, err := base64.RawURLEncoding.DecodeString(b64Str)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new(string(b))
}
// --------------------------------`;

export const base64Module: NativeModule = {
  path: "encoding/base64",

  types: [
    {
      name: "base64",
      statics: [
        { name: "encode", arity: 1, returns: { kind: "NamedTypeNode", name: "String" } },
        { name: "decode", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "String" }, { kind: "String" }] } },
        { name: "encode_url_safe", arity: 1, returns: { kind: "NamedTypeNode", name: "String" } },
        { name: "decode_url_safe", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "String" }, { kind: "String" }] } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: (interpreter) => ({
    base64: {
      [NATIVE_TAG]: "base64",
      encode: (payload: string) => {
        return Buffer.from(payload, "utf-8").toString("base64");
      },
      decode: (b64Str: string) => {
        try {
          // Node's Buffer.from base64 tolerates many invalid chars. We need a basic check.
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64Str)) {
            return resultErr("Invalid standard base64 string");
          }
          const buf = Buffer.from(b64Str, "base64");
          return resultOk(buf.toString("utf-8"));
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
      encode_url_safe: (payload: string) => {
        return Buffer.from(payload, "utf-8").toString("base64url");
      },
      decode_url_safe: (b64Str: string) => {
        try {
          if (!/^[A-Za-z0-9_-]*$/.test(b64Str)) {
            return resultErr("Invalid url-safe base64 string");
          }
          const buf = Buffer.from(b64Str, "base64url");
          return resultOk(buf.toString("utf-8"));
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
    }
  }),

  goCodegen: {
    imports: ["encoding/base64"],
    boilerplate: GO_BOILERPLATE,
  },
};
