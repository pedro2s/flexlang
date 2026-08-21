import { NATIVE_TAG, type NativeModule } from "./types";
import { optionNone, optionSome, resultErr, resultOk } from "../stdlib";
import type { Interpreter } from "../interpreter";

export class TestAssertionError extends Error {
  readonly isAssertionError = true;
  constructor(message: string) {
    super(message);
    this.name = "TestAssertionError";
  }
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") {
    if (v.kind === "EnumVariant") {
      if (v.payload && v.payload.length > 0) {
        return `${v.enumName}.${v.variantName}(${v.payload.map(formatValue).join(", ")})`;
      }
      return `${v.enumName}.${v.variantName}`;
    }
    if (v instanceof Map) {
      const entries: string[] = [];
      for (const [k, val] of v.entries()) {
        entries.push(`${k}: ${formatValue(val)}`);
      }
      return `{ ${entries.join(", ")} }`;
    }
    if (Array.isArray(v)) {
      return `[${v.map(formatValue).join(", ")}]`;
    }
    if (typeof v.to_string === "function") {
      try {
        return v.to_string();
      } catch {}
    }
  }
  return String(v);
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    if (a.kind === "EnumVariant" && b.kind === "EnumVariant") {
      if (a.enumName !== b.enumName || a.variantName !== b.variantName) return false;
      const pA = a.payload ?? [];
      const pB = b.payload ?? [];
      if (pA.length !== pB.length) return false;
      for (let i = 0; i < pA.length; i++) {
        if (!deepEqual(pA[i], pB[i])) return false;
      }
      return true;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a.entries()) {
        if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
      }
      return true;
    }

    if (typeof a.to_string === "function" && typeof b.to_string === "function") {
      try {
        return a.to_string() === b.to_string();
      } catch {}
    }
  }

  return false;
}

export class FlexTesting {
  readonly [NATIVE_TAG] = "testing";

  assert_true(condition: boolean, message?: string): void {
    if (condition !== true) {
      const detail = message && message.trim().length > 0 ? `: ${message}` : "";
      throw new TestAssertionError(`assertion failed: expected true, got false${detail}`);
    }
  }

  assert_false(condition: boolean, message?: string): void {
    if (condition !== false) {
      const detail = message && message.trim().length > 0 ? `: ${message}` : "";
      throw new TestAssertionError(`assertion failed: expected false, got true${detail}`);
    }
  }

  assert_eq(actual: any, expected: any, message?: string): void {
    if (!deepEqual(actual, expected)) {
      const detail = message && message.trim().length > 0 ? ` (${message})` : "";
      throw new TestAssertionError(
        `assertion failed: expected '${formatValue(expected)}', got '${formatValue(actual)}'${detail}`,
      );
    }
  }

  assert_neq(actual: any, expected: any, message?: string): void {
    if (deepEqual(actual, expected)) {
      const detail = message && message.trim().length > 0 ? ` (${message})` : "";
      throw new TestAssertionError(
        `assertion failed: expected values to differ, both are '${formatValue(actual)}'${detail}`,
      );
    }
  }

  assert_ok(result: any, message?: string): any {
    if (result && typeof result === "object" && result.kind === "EnumVariant") {
      if (result.variantName === "Ok") {
        return result.payload?.[0];
      }
      if (result.variantName === "Err") {
        const errPayload = result.payload?.[0];
        const detail = message && message.trim().length > 0 ? ` (${message})` : "";
        throw new TestAssertionError(
          `assertion failed: expected Result.Ok, got Result.Err('${formatValue(errPayload)}')${detail}`,
        );
      }
    }
    const detail = message && message.trim().length > 0 ? ` (${message})` : "";
    throw new TestAssertionError(`assertion failed: expected Result.Ok, got '${formatValue(result)}'${detail}`);
  }

  assert_err(result: any, message?: string): any {
    if (result && typeof result === "object" && result.kind === "EnumVariant") {
      if (result.variantName === "Err") {
        return result.payload?.[0];
      }
      if (result.variantName === "Ok") {
        const okPayload = result.payload?.[0];
        const detail = message && message.trim().length > 0 ? ` (${message})` : "";
        throw new TestAssertionError(
          `assertion failed: expected Result.Err, got Result.Ok('${formatValue(okPayload)}')${detail}`,
        );
      }
    }
    const detail = message && message.trim().length > 0 ? ` (${message})` : "";
    throw new TestAssertionError(`assertion failed: expected Result.Err, got '${formatValue(result)}'${detail}`);
  }

  assert_some(option: any, message?: string): any {
    if (option && typeof option === "object" && option.kind === "EnumVariant") {
      if (option.variantName === "Some") {
        return option.payload?.[0];
      }
      if (option.variantName === "None") {
        const detail = message && message.trim().length > 0 ? ` (${message})` : "";
        throw new TestAssertionError(`assertion failed: expected Option.Some, got Option.None${detail}`);
      }
    }
    const detail = message && message.trim().length > 0 ? ` (${message})` : "";
    throw new TestAssertionError(`assertion failed: expected Option.Some, got '${formatValue(option)}'${detail}`);
  }

  assert_none(option: any, message?: string): void {
    if (option && typeof option === "object" && option.kind === "EnumVariant") {
      if (option.variantName === "None") {
        return;
      }
      if (option.variantName === "Some") {
        const val = option.payload?.[0];
        const detail = message && message.trim().length > 0 ? ` (${message})` : "";
        throw new TestAssertionError(
          `assertion failed: expected Option.None, got Option.Some('${formatValue(val)}')${detail}`,
        );
      }
    }
    const detail = message && message.trim().length > 0 ? ` (${message})` : "";
    throw new TestAssertionError(`assertion failed: expected Option.None, got '${formatValue(option)}'${detail}`);
  }
}

export const testingInstance = new FlexTesting();

const GO_BOILERPLATE = `// --- FlexLang std/testing (RFC-041) ---
func testing_assert_true(cond any, args ...string) {
	b := false
	switch v := cond.(type) {
	case bool:
		b = v
	case int:
		b = v != 0
	default:
		b = v != nil
	}
	if !b {
		msg := ""
		if len(args) > 0 && len(args[0]) > 0 {
			msg = ": " + args[0]
		}
		panic(fmt.Sprintf("assertion failed: expected true, got false%s", msg))
	}
}

func testing_assert_false(cond any, args ...string) {
	b := false
	switch v := cond.(type) {
	case bool:
		b = v
	case int:
		b = v != 0
	default:
		b = v != nil
	}
	if b {
		msg := ""
		if len(args) > 0 && len(args[0]) > 0 {
			msg = ": " + args[0]
		}
		panic(fmt.Sprintf("assertion failed: expected false, got true%s", msg))
	}
}

func testing_format_val(v any) string {
	if v == nil {
		return "null"
	}
	if str, ok := v.(string); ok {
		return str
	}
	if opt, ok := v.(Option_Some); ok {
		return fmt.Sprintf("Option.Some(%s)", testing_format_val(opt.Field0))
	}
	if v == Option_None {
		return "Option.None"
	}
	if res, ok := v.(Result_Ok); ok {
		return fmt.Sprintf("Result.Ok(%s)", testing_format_val(res.Field0))
	}
	if res, ok := v.(Result_Err); ok {
		return fmt.Sprintf("Result.Err(%s)", testing_format_val(res.Field0))
	}
	return fmt.Sprintf("%v", v)
}

func testing_assert_eq(actual any, expected any, args ...string) {
	actStr := testing_format_val(actual)
	expStr := testing_format_val(expected)
	if actStr != expStr && !reflect.DeepEqual(actual, expected) {
		msg := ""
		if len(args) > 0 && len(args[0]) > 0 {
			msg = fmt.Sprintf(" (%s)", args[0])
		}
		panic(fmt.Sprintf("assertion failed: expected '%s', got '%s'%s", expStr, actStr, msg))
	}
}

func testing_assert_neq(actual any, expected any, args ...string) {
	actStr := testing_format_val(actual)
	expStr := testing_format_val(expected)
	if actStr == expStr || reflect.DeepEqual(actual, expected) {
		msg := ""
		if len(args) > 0 && len(args[0]) > 0 {
			msg = fmt.Sprintf(" (%s)", args[0])
		}
		panic(fmt.Sprintf("assertion failed: expected values to differ, both are '%s'%s", actStr, msg))
	}
}

func testing_assert_ok(res any, args ...string) any {
	if okRes, ok := res.(Result_Ok); ok {
		return okRes.Field0
	}
	msg := ""
	if len(args) > 0 && len(args[0]) > 0 {
		msg = fmt.Sprintf(" (%s)", args[0])
	}
	panic(fmt.Sprintf("assertion failed: expected Result.Ok, got '%s'%s", testing_format_val(res), msg))
}

func testing_assert_err(res any, args ...string) any {
	if errRes, ok := res.(Result_Err); ok {
		return errRes.Field0
	}
	msg := ""
	if len(args) > 0 && len(args[0]) > 0 {
		msg = fmt.Sprintf(" (%s)", args[0])
	}
	panic(fmt.Sprintf("assertion failed: expected Result.Err, got '%s'%s", testing_format_val(res), msg))
}

func testing_assert_some(opt any, args ...string) any {
	if someOpt, ok := opt.(Option_Some); ok {
		return someOpt.Field0
	}
	msg := ""
	if len(args) > 0 && len(args[0]) > 0 {
		msg = fmt.Sprintf(" (%s)", args[0])
	}
	panic(fmt.Sprintf("assertion failed: expected Option.Some, got '%s'%s", testing_format_val(opt), msg))
}

func testing_assert_none(opt any, args ...string) {
	if opt == Option_None {
		return
	}
	if _, ok := opt.(Option_Some); !ok {
		return
	}
	msg := ""
	if len(args) > 0 && len(args[0]) > 0 {
		msg = fmt.Sprintf(" (%s)", args[0])
	}
	panic(fmt.Sprintf("assertion failed: expected Option.None, got '%s'%s", testing_format_val(opt), msg))
}
// -------------------------------------`;

export const testingModule: NativeModule = {
  path: "std/testing",

  types: [
    {
      name: "testing",
      statics: [
        {
          name: "assert_true",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Void" },
        },
        {
          name: "assert_false",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Void" },
        },
        {
          name: "assert_eq",
          minArity: 2,
          maxArity: 3,
          returns: { kind: "Void" },
        },
        {
          name: "assert_neq",
          minArity: 2,
          maxArity: 3,
          returns: { kind: "Void" },
        },
        {
          name: "assert_ok",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Any" },
        },
        {
          name: "assert_err",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Any" },
        },
        {
          name: "assert_some",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Any" },
        },
        {
          name: "assert_none",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Void" },
        },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (_interpreter: Interpreter) => ({
    testing: {
      [NATIVE_TAG]: "testing",
      assert_true: (cond: boolean, msg?: string) => testingInstance.assert_true(cond, msg),
      assert_false: (cond: boolean, msg?: string) => testingInstance.assert_false(cond, msg),
      assert_eq: (actual: any, expected: any, msg?: string) => testingInstance.assert_eq(actual, expected, msg),
      assert_neq: (actual: any, expected: any, msg?: string) => testingInstance.assert_neq(actual, expected, msg),
      assert_ok: (res: any, msg?: string) => testingInstance.assert_ok(res, msg),
      assert_err: (res: any, msg?: string) => testingInstance.assert_err(res, msg),
      assert_some: (opt: any, msg?: string) => testingInstance.assert_some(opt, msg),
      assert_none: (opt: any, msg?: string) => testingInstance.assert_none(opt, msg),
    },
  }),

  goCodegen: {
    imports: ["fmt", "reflect"],
    boilerplate: GO_BOILERPLATE,
  },
};
