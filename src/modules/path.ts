import { NATIVE_TAG, type NativeModule } from "./types";
import * as nodePath from "path";

const GO_BOILERPLATE = `// --- FlexLang std/path ---
func path_join(paths []any) string {
    strPaths := make([]string, len(paths))
    for i, p := range paths {
        strPaths[i] = p.(string)
    }
    return filepath.Join(strPaths...)
}

func path_normalize(p string) string {
    return filepath.Clean(p)
}

func path_basename(p string) string {
    return filepath.Base(p)
}

func path_dirname(p string) string {
    return filepath.Dir(p)
}

func path_ext(p string) string {
    return filepath.Ext(p)
}

func path_is_absolute(p string) bool {
    return filepath.IsAbs(p)
}
// --------------------------`;

export const pathModule: NativeModule = {
  path: "std/path",

  types: [
    {
      name: "path",
      statics: [
        { name: "join", arity: 1, returns: { kind: "String" } },
        { name: "normalize", arity: 1, returns: { kind: "String" } },
        { name: "basename", arity: 1, returns: { kind: "String" } },
        { name: "dirname", arity: 1, returns: { kind: "String" } },
        { name: "ext", arity: 1, returns: { kind: "String" } },
        { name: "is_absolute", arity: 1, returns: { kind: "Bool" } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: [],

  runtimeBinding: (interpreter) => ({
    path: {
      [NATIVE_TAG]: "path",
      join: (paths: any[]) => {
        return nodePath.join(...paths.map(p => String(p)));
      },
      normalize: (p: string) => {
        return nodePath.normalize(p);
      },
      basename: (p: string) => {
        return nodePath.basename(p);
      },
      dirname: (p: string) => {
        return nodePath.dirname(p);
      },
      ext: (p: string) => {
        return nodePath.extname(p);
      },
      is_absolute: (p: string) => {
        return nodePath.isAbsolute(p);
      },
    }
  }),

  goCodegen: {
    imports: ["path/filepath"],
    boilerplate: GO_BOILERPLATE,
  },
};
