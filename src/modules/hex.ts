import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";

const GO_BOILERPLATE = `// --- FlexLang encoding/hex ---
func hex_encode(payload string) string {
    return hex.EncodeToString([]byte(payload))
}

func hex_decode(hexStr string) Result {
    b, err := hex.DecodeString(hexStr)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new(string(b))
}
// -----------------------------`;

export const hexModule: NativeModule = {
  path: "encoding/hex",

  types: [
    {
      name: "hex",
      statics: [
        { name: "encode", arity: 1, returns: { kind: "NamedTypeNode", name: "String" } },
        { name: "decode", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "String" }, { kind: "String" }] } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: (interpreter) => ({
    hex: {
      [NATIVE_TAG]: "hex",
      encode: (payload: string) => {
        return Buffer.from(payload, "utf-8").toString("hex");
      },
      decode: (hexStr: string) => {
        try {
          // A verificação rigorosa de hex em Node pode requerer regex, pois Buffer.from ignora chars invalidos
          if (!/^[0-9a-fA-F]*$/.test(hexStr)) {
             return resultErr("Invalid hexadecimal string");
          }
          const buf = Buffer.from(hexStr, "hex");
          return resultOk(buf.toString("utf-8"));
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
    }
  }),

  goCodegen: {
    imports: ["encoding/hex"],
    boilerplate: GO_BOILERPLATE,
  },
};
