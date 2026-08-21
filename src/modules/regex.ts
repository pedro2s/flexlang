import { NATIVE_TAG, type NativeModule } from "./types";
import { optionNone, optionSome, resultErr, resultOk } from "../stdlib";
import type { Interpreter } from "../interpreter";

function makeMatchResult(text: string, start: number, end: number): Map<string, unknown> {
  const m = new Map<string, unknown>();
  m.set("text", text);
  m.set("start", start);
  m.set("end", end);
  return m;
}

function normalizePattern(pattern: string): string {
  if (!pattern) return "";
  return pattern.replace(/\\\\/g, "\\");
}

export class FlexRegex {
  readonly [NATIVE_TAG] = "Regex";
  public pattern: string;
  private normalized: string;

  constructor(pattern: string) {
    this.pattern = pattern;
    this.normalized = normalizePattern(pattern);
    // Valida sintaxe no construtor
    new RegExp(this.normalized);
  }

  matches(text: string): boolean {
    if (text === null || text === undefined) return false;
    const re = new RegExp(this.normalized);
    return re.test(text);
  }

  find(text: string): unknown {
    if (text === null || text === undefined) return optionNone();
    const re = new RegExp(this.normalized);
    const match = re.exec(text);
    if (!match) {
      return optionNone();
    }
    const matchedText = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + matchedText.length;
    return optionSome(makeMatchResult(matchedText, startIndex, endIndex));
  }

  find_all(text: string): unknown[] {
    if (text === null || text === undefined) return [];
    const re = new RegExp(this.normalized, "g");
    const results: unknown[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const matchedText = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;
      results.push(makeMatchResult(matchedText, startIndex, endIndex));
      if (match.index === re.lastIndex) {
        re.lastIndex++;
      }
    }
    return results;
  }

  replace_all(text: string, repl: string): string {
    if (text === null || text === undefined) return "";
    const re = new RegExp(this.normalized, "g");
    return text.replace(re, repl ?? "");
  }

  split(text: string): string[] {
    if (text === null || text === undefined) return [];
    const re = new RegExp(this.normalized);
    return text.split(re);
  }
}

const GO_BOILERPLATE = `// --- FlexLang std/regex (RFC-044) ---
type MatchResult struct {
	text  string
	start int
	end   int
}

type Regex struct {
	re      *regexp.Regexp
	pattern string
}

func regex_compile(pattern string) Result {
	pattern = strings.ReplaceAll(pattern, string([]byte{92, 92}), string([]byte{92}))
	re, err := regexp.Compile(pattern)
	if err != nil {
		return Result_Err_new(fmt.Sprintf("Invalid regex pattern: %s", err.Error()))
	}
	return Result_Ok_new(&Regex{
		re:      re,
		pattern: pattern,
	})
}

func regex_is_match(pattern string, text string) Result {
	pattern = strings.ReplaceAll(pattern, string([]byte{92, 92}), string([]byte{92}))
	re, err := regexp.Compile(pattern)
	if err != nil {
		return Result_Err_new(fmt.Sprintf("Invalid regex pattern: %s", err.Error()))
	}
	return Result_Ok_new(re.MatchString(text))
}

func (r *Regex) matches(text string) bool {
	if r == nil || r.re == nil {
		return false
	}
	return r.re.MatchString(text)
}

func (r *Regex) find(text string) Option {
	if r == nil || r.re == nil {
		return Option_None
	}
	loc := r.re.FindStringIndex(text)
	if loc == nil {
		return Option_None
	}
	start := loc[0]
	end := loc[1]
	matchedText := text[start:end]
	return Option_Some_new(&MatchResult{
		text:  matchedText,
		start: start,
		end:   end,
	})
}

func (r *Regex) find_all(text string) []any {
	if r == nil || r.re == nil {
		return []any{}
	}
	locs := r.re.FindAllStringIndex(text, -1)
	var list []any
	for _, loc := range locs {
		start := loc[0]
		end := loc[1]
		matchedText := text[start:end]
		list = append(list, &MatchResult{
			text:  matchedText,
			start: start,
			end:   end,
		})
	}
	if list == nil {
		return []any{}
	}
	return list
}

func (r *Regex) replace_all(text string, repl string) string {
	if r == nil || r.re == nil {
		return text
	}
	return r.re.ReplaceAllString(text, repl)
}

func (r *Regex) split(text string) []any {
	if r == nil || r.re == nil {
		return []any{text}
	}
	parts := r.re.Split(text, -1)
	var list []any
	for _, p := range parts {
		list = append(list, p)
	}
	if list == nil {
		return []any{}
	}
	return list
}
// ------------------------------------`;

export const regexModule: NativeModule = {
  path: "std/regex",

  types: [
    {
      name: "MatchResult",
      goPointer: true,
      properties: [
        { name: "text", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "start", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "end", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    {
      name: "Regex",
      goPointer: true,
      methods: [
        {
          name: "matches",
          arity: 1,
          returns: { kind: "Bool" },
        },
        {
          name: "find",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Option",
            genericArgs: [{ kind: "Struct", name: "MatchResult", genericArgs: [] }],
          },
        },
        {
          name: "find_all",
          arity: 1,
          returns: {
            kind: "Array",
            elementType: { kind: "Struct", name: "MatchResult", genericArgs: [] },
          },
        },
        {
          name: "replace_all",
          arity: 2,
          returns: { kind: "String" },
        },
        {
          name: "split",
          arity: 1,
          returns: {
            kind: "Array",
            elementType: { kind: "String" },
          },
        },
      ],
    },
    {
      name: "regex",
      statics: [
        {
          name: "compile",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Struct", name: "Regex", genericArgs: [] },
              { kind: "String" },
            ],
          },
        },
        {
          name: "is_match",
          arity: 2,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Bool" },
              { kind: "String" },
            ],
          },
        },
      ],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: (_interpreter: Interpreter) => ({
    MatchResult: {
      kind: "StructDeclaration",
      name: "MatchResult",
      properties: [
        { name: "text", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "start", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
        { name: "end", typeAnnotation: { kind: "NamedTypeNode", name: "Int" } },
      ],
    },
    Regex: {
      [NATIVE_TAG]: "Regex",
    },
    regex: {
      [NATIVE_TAG]: "regex",
      compile: (pattern: string) => {
        try {
          return resultOk(new FlexRegex(pattern));
        } catch (e: any) {
          return resultErr(`Invalid regex pattern: ${e.message || String(e)}`);
        }
      },
      is_match: (pattern: string, text: string) => {
        try {
          const re = new FlexRegex(pattern);
          return resultOk(re.matches(text));
        } catch (e: any) {
          return resultErr(`Invalid regex pattern: ${e.message || String(e)}`);
        }
      },
    },
  }),

  goCodegen: {
    imports: ["regexp", "fmt", "strings"],
    boilerplate: GO_BOILERPLATE,
  },
};
