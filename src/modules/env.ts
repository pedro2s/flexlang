import { NATIVE_TAG, type NativeModule } from "./types";
import { optionSome, optionNone } from "../stdlib";

const GO_BOILERPLATE = `// --- FlexLang os/env ---
func env_get(name string) Option {
	v, ok := os.LookupEnv(name)
	if !ok {
		return Option_None
	}
	return Option_Some_new(v)
}

func env_get_or(name, def string) string {
	v, ok := os.LookupEnv(name)
	if !ok {
		return def
	}
	return v
}

func env_require(name string) string {
	v, ok := os.LookupEnv(name)
	if !ok {
		panic("EnvError: Required environment variable '" + name + "' is not set")
	}
	return v
}

func env_has(name string) bool {
	_, ok := os.LookupEnv(name)
	return ok
}
// -----------------------`;

export const envModule: NativeModule = {
  path: "os/env",

  types: [
    {
      name: "env",
      statics: [
        {
          name: "get",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Option",
            genericArgs: [{ kind: "String" }],
          },
        },
        {
          name: "get_or",
          arity: 2,
          returns: { kind: "String" },
        },
        {
          name: "require",
          arity: 1,
          returns: { kind: "String" },
        },
        {
          name: "has",
          arity: 1,
          returns: { kind: "Bool" },
        },
      ],
    },
  ],

  usesBuiltins: ["Option"],

  runtimeBinding: () => ({
    env: {
      [NATIVE_TAG]: "env",
      get: (name: string) => {
        const v = process.env[name];
        return v !== undefined ? optionSome(v) : optionNone();
      },
      get_or: (name: string, def: string) => {
        const v = process.env[name];
        return v !== undefined ? v : def;
      },
      require: (name: string) => {
        const v = process.env[name];
        if (v === undefined) {
          throw new Error(`EnvError: Required environment variable '${name}' is not set`);
        }
        return v;
      },
      has: (name: string) => process.env[name] !== undefined,
    },
  }),

  goCodegen: {
    imports: ["os"],
    boilerplate: GO_BOILERPLATE,
  },
};
