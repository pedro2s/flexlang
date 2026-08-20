import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";
import * as fs from "fs";
import * as fsPromises from "fs/promises";

const GO_BOILERPLATE = `// --- FlexLang std/fs ---
func fs_read_to_string(path string) Result {
    b, err := os.ReadFile(path)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new(string(b))
}

func fs_write_string(path string, content string) Result {
    err := os.WriteFile(path, []byte(content), 0644)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new("OK")
}

func fs_append_string(path string, content string) Result {
    f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    defer f.Close()
    if _, err := f.WriteString(content); err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new("OK")
}

func fs_exists(path string) bool {
    _, err := os.Stat(path)
    return err == nil || !os.IsNotExist(err)
}

func fs_is_file(path string) bool {
    stat, err := os.Stat(path)
    return err == nil && !stat.IsDir()
}

func fs_is_dir(path string) bool {
    stat, err := os.Stat(path)
    return err == nil && stat.IsDir()
}

func fs_create_dir_all(path string) Result {
    err := os.MkdirAll(path, 0755)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new("OK")
}

func fs_read_dir(path string) Result {
    entries, err := os.ReadDir(path)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    names := make([]any, 0, len(entries))
    for _, e := range entries {
        names = append(names, e.Name())
    }
    return Result_Ok_new(names)
}

func fs_remove_file(path string) Result {
    err := os.Remove(path)
    if err != nil {
        return Result_Err_new(err.Error())
    }
    return Result_Ok_new("OK")
}
// ------------------------`;

export const fsModule: NativeModule = {
  path: "std/fs",

  types: [
    {
      name: "fs",
      statics: [
        { name: "read_to_string", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "write_string", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "append_string", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "exists", arity: 1, returns: { kind: "NamedTypeNode", name: "Bool" } },
        { name: "is_file", arity: 1, returns: { kind: "NamedTypeNode", name: "Bool" } },
        { name: "is_dir", arity: 1, returns: { kind: "NamedTypeNode", name: "Bool" } },
        { name: "create_dir_all", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "read_dir", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "ArrayTypeNode", valueType: { kind: "NamedTypeNode", name: "String" } }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "remove_file", arity: 1, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: (interpreter) => ({
    fs: {
      [NATIVE_TAG]: "fs",
      read_to_string: async (path: string) => {
        try {
          const data = await fsPromises.readFile(path, "utf-8");
          return resultOk(data);
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
      write_string: async (path: string, content: string) => {
        try {
          await fsPromises.writeFile(path, content, "utf-8");
          return resultOk("OK");
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
      append_string: async (path: string, content: string) => {
        try {
          await fsPromises.appendFile(path, content, "utf-8");
          return resultOk("OK");
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
      exists: (path: string) => {
        return fs.existsSync(path);
      },
      is_file: (path: string) => {
        try { return fs.statSync(path).isFile(); } catch { return false; }
      },
      is_dir: (path: string) => {
        try { return fs.statSync(path).isDirectory(); } catch { return false; }
      },
      create_dir_all: async (path: string) => {
        try {
          await fsPromises.mkdir(path, { recursive: true });
          return resultOk("OK");
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
      read_dir: async (path: string) => {
        try {
          const files = await fsPromises.readdir(path);
          return resultOk(files); // Auto converted to FlexLang arrays by interpreter
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
      remove_file: async (path: string) => {
        try {
          await fsPromises.unlink(path);
          return resultOk("OK");
        } catch (e: any) {
          return resultErr(e.message || String(e));
        }
      },
    }
  }),

  goCodegen: {
    imports: ["os"],
    boilerplate: GO_BOILERPLATE,
  },
};
