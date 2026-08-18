import type {
  Stmt,
  IfStmt,
  Expr,
  TypeNode,
  EnumDeclaration,
  FunctionDeclaration,
  Parameter,
  StructDeclaration,
} from "./ast";
import type { FlexType, TypeMap } from "./checker";
import * as path from "path";
import { builtinEnums, isBuiltinType, successVariant } from "./stdlib";
import { registry } from "./modules/registry";
import { modulePath, type NativeType } from "./modules/types";
import { type ModuleGraph, isLocalModule } from "./loader";

/**
 * Identificadores legítimos em FlexLang que o Go não aceita: palavras reservadas
 * (`type`, `range`, `map`, ...) e `main`/`init`, que colidiriam com o entrypoint
 * gerado. São prefixados para não quebrar programas válidos na hora de compilar.
 */
const GO_RESERVED = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough",
  "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range",
  "return", "select", "struct", "switch", "type", "var",
  "main", "init",
]);

export class GoTranspiler {
  private out: string = "";
  private indentLevel: number = 0;
  private importedModules = new Set<string>();
  private goImports = new Set<string>();

  // Tabelas de declarações, preenchidas antes de emitir qualquer código.
  private enums = new Map<string, EnumDeclaration>();
  private structNames = new Set<string>();
  // Declaração completa (não só o nome) de cada struct do usuário: o transpiler
  // precisa saber a lista de campos para decidir, em um MemberExpr, se
  // `expr.property` é um campo (capitalizado em Go, ver `goFieldName`) ou uma
  // chamada de método (fica minúsculo) — só campos passam por `encoding/json`.
  private structDecls = new Map<string, StructDeclaration>();
  private traitNames = new Set<string>();

  // Tipos embutidos (Result/Option) referenciados pelo programa: só esses são
  // emitidos, para não poluir a saída de quem não usa nenhum dos dois.
  private usedBuiltins = new Set<string>();

  // Superfície dos módulos nativos importados (RFC-003), por nome de tipo.
  private nativeTypes = new Map<string, NativeType>();

  // Anotação de tipos vinda do TypeChecker (ver RFC-001).
  private types: TypeMap = new Map();

  private tmpCount = 0;
  private funcDepth = 0;
  private usedStringHelpers = false;
  private usedParseIntHelper = false;
  private usedParseFloatHelper = false;

  constructor() {}

  public transpile(program: Stmt[] | ModuleGraph, types?: TypeMap): string {
    this.out = "";
    this.indentLevel = 0;
    this.tmpCount = 0;
    this.funcDepth = 0;
    this.goImports.clear();
    this.importedModules.clear();
    this.enums.clear();
    this.structNames.clear();
    this.structDecls.clear();
    this.traitNames.clear();
    this.usedBuiltins.clear();
    this.usedStringHelpers = false;
    this.usedParseIntHelper = false;
    this.usedParseFloatHelper = false;
    this.nativeTypes.clear();
    this.types = types ?? new Map();

    // Result/Option não são declarados pelo usuário: entram direto na tabela
    // e são emitidos pelo cabeçalho, se o programa referenciar algum.
    for (const builtin of builtinEnums()) {
      this.enums.set(builtin.name, builtin);
    }

    const graph: ModuleGraph = Array.isArray(program)
      ? {
          entryPath: "main.flex",
          files: new Map([
            [
              "main.flex",
              {
                filePath: "main.flex",
                ast: program,
                imports: [],
                declarations: [],
                localDependencies: [],
              },
            ],
          ]),
          order: ["main.flex"],
        }
      : program;

    const declarations: Stmt[] = [];
    const mainStatements: Stmt[] = [];
    // Mapeia símbolo global para o arquivo que o declarou, para detecção de colisão
    const declaredSymbols = new Map<string, string>();

    const checkDuplicateSymbol = (name: string, filePath: string) => {
      if (declaredSymbols.has(name) && declaredSymbols.get(name) !== filePath) {
        const fileA = path.basename(declaredSymbols.get(name)!);
        const fileB = path.basename(filePath);
        throw new Error(
          `CompileError: Duplicate symbol '${name}' declared across modules ('${fileA}' and '${fileB}')`,
        );
      }
      declaredSymbols.set(name, filePath);
    };

    // Separa declaracoes de escopo global (structs, funcs) do corpo do programa
    // e registra os nomes declarados (necessário para resolver tipos ao emitir).
    for (const filePath of graph.order) {
      const sourceFile = graph.files.get(filePath)!;
      for (const stmt of sourceFile.ast) {
        switch (stmt.kind) {
          case "ImportDeclaration": {
            if (isLocalModule(stmt.moduleName)) {
              // Imports locais não geram import no código Go compilado
              break;
            }
            this.importedModules.add(stmt.moduleName);
            const mod = registry.get(modulePath(stmt.moduleName));
            for (const nativeType of mod?.types ?? []) {
              this.nativeTypes.set(nativeType.name, nativeType);
            }
            // O módulo pode referenciar Result/Option direto no seu boilerplate Go
            // (ex: net/http, RFC-004) sem que o programa do usuário os use em
            // nenhum outro lugar — sem isso o cabeçalho não emitiria a definição.
            for (const builtinName of mod?.usesBuiltins ?? []) {
              this.markBuiltinUse(builtinName);
            }
            break;
          }
          case "EnumDeclaration":
            checkDuplicateSymbol(stmt.name, filePath);
            this.enums.set(stmt.name, stmt);
            declarations.push(stmt);
            break;
          case "StructDeclaration":
            checkDuplicateSymbol(stmt.name, filePath);
            this.structNames.add(stmt.name);
            this.structDecls.set(stmt.name, stmt);
            declarations.push(stmt);
            break;
          case "TraitDeclaration":
            checkDuplicateSymbol(stmt.name, filePath);
            this.traitNames.add(stmt.name);
            declarations.push(stmt);
            break;
          case "FunctionDeclaration":
            checkDuplicateSymbol(stmt.name, filePath);
            declarations.push(stmt);
            break;
          case "ConstDeclaration":
            checkDuplicateSymbol(stmt.name, filePath);
            declarations.push(stmt);
            break;
          case "ImplDeclaration":
            declarations.push(stmt);
            break;
          default:
            mainStatements.push(stmt);
        }
      }
    }

    for (const decl of declarations) {
      this.transpileStmt(decl);
      this.emitLine("");
    }

    this.emitLine("func main() {");
    this.indent();
    this.funcDepth++;
    this.transpileStmts(mainStatements);
    this.funcDepth--;
    this.dedent();
    this.emitLine("}");

    // O cabeçalho só é montado no fim: as importações do Go dependem do que
    // o corpo realmente usou (import não usado é erro de compilação em Go).
    return this.buildHeader() + this.out;
  }

  // =========== CABEÇALHO (package + imports + boilerplate) ===========

  private buildHeader(): string {
    const lines: string[] = ["package main", ""];

    // Cada módulo importado diz o que precisa em Go — nenhum nome de módulo
    // aparece aqui dentro (RFC-003).
    const boilerplates: string[] = [];
    for (const moduleName of this.importedModules) {
      const mod = registry.get(modulePath(moduleName));
      if (!mod) continue; // import inválido já foi recusado pelo checker
      for (const goImport of mod.goCodegen.imports) this.goImports.add(goImport);
      if (mod.goCodegen.boilerplate) boilerplates.push(mod.goCodegen.boilerplate);
    }

    const imports = [...this.goImports].sort();
    if (imports.length === 1) {
      lines.push(`import "${imports[0]}"`);
      lines.push("");
    } else if (imports.length > 1) {
      lines.push("import (");
      for (const imp of imports) lines.push(`  "${imp}"`);
      lines.push(")");
      lines.push("");
    }

    if (this.usedBuiltins.size > 0) {
      lines.push("// --- FlexLang stdlib: Result / Option ---");
      for (const builtin of builtinEnums()) {
        if (!this.usedBuiltins.has(builtin.name)) continue;
        lines.push(this.capture(() => this.transpileEnum(builtin)).trimEnd());
      }
      lines.push("// ---------------------------------------", "");
    }

    if (this.usedStringHelpers) {
      lines.push(
        "func flex_string_index_of(s, sub string) Option {",
        "\tidx := strings.Index(s, sub)",
        "\tif idx == -1 {",
        "\t\treturn Option_None",
        "\t}",
        "\tcharIdx := len([]rune(s[:idx]))",
        "\treturn Option_Some_new(charIdx)",
        "}",
        ""
      );
    }

    if (this.usedParseIntHelper) {
      lines.push(
        "func flex_parse_int(s string) Result {",
        "\tv, err := strconv.Atoi(s)",
        "\tif err != nil {",
        "\t\treturn Result_Err_new(err.Error())",
        "\t}",
        "\treturn Result_Ok_new(v)",
        "}",
        ""
      );
    }

    if (this.usedParseFloatHelper) {
      lines.push(
        "func flex_parse_float(s string) Result {",
        "\tv, err := strconv.ParseFloat(s, 64)",
        "\tif err != nil {",
        "\t\treturn Result_Err_new(err.Error())",
        "\t}",
        "\treturn Result_Ok_new(v)",
        "}",
        ""
      );
    }

    for (const boilerplate of boilerplates) {
      lines.push(boilerplate, "");
    }

    return lines.join("\n") + "\n";
  }

  private emitLine(code: string) {
    if (code.trim() === "") {
      this.out += "\n";
      return;
    }
    this.out += "  ".repeat(this.indentLevel) + code + "\n";
  }

  private indent() {
    this.indentLevel++;
  }

  private dedent() {
    this.indentLevel--;
  }

  private nextTmp(prefix: string): string {
    return `__${prefix}${this.tmpCount++}`;
  }

  /** Emite para um buffer separado, sem tocar na saída em construção. */
  private capture(emit: () => void): string {
    const savedOut = this.out;
    const savedIndent = this.indentLevel;
    this.out = "";
    this.indentLevel = 0;
    emit();
    const captured = this.out;
    this.out = savedOut;
    this.indentLevel = savedIndent;
    return captured;
  }

  // =========== STATEMENTS ===========

  private transpileStmts(stmts: Stmt[]): void {
    for (let i = 0; i < stmts.length; i++) {
      // O "resto" do bloco permite saber se uma variável declarada aqui chega a
      // ser lida: em Go, variável local declarada e não usada é erro de compilação.
      this.transpileStmt(stmts[i]!, stmts.slice(i + 1));
    }
  }

  private transpileStmt(stmt: Stmt, rest: Stmt[] = []): void {
    switch (stmt.kind) {
      case "PrintStmt": {
        this.goImports.add("fmt");
        const value = this.transpileExpr(stmt.value);
        this.emitLine(`fmt.Println(${value})`);
        break;
      }

      case "ConstDeclaration": {
        const value = this.transpileExpr(stmt.value);
        const declaredType = stmt.typeAnnotation ? this.transpileType(stmt.typeAnnotation) : undefined;
        if (declaredType) {
          this.emitLine(`const ${this.goIdent(stmt.name)} ${declaredType} = ${value}`);
        } else {
          this.emitLine(`const ${this.goIdent(stmt.name)} = ${value}`);
        }
        this.emitDiscardIfUnused(stmt.name, rest);
        break;
      }

      case "VarDeclaration": {
        // Como o TypeChecker já validou a mutabilidade, no Go será apenas uma variável comum
        // Usamos a inferência nativa do Go := ou var quando necessário para float
        const declaredType = stmt.typeAnnotation ? this.transpileType(stmt.typeAnnotation) : undefined;
        const resolvedType = this.types.get(stmt.value);
        const isFloatContext = declaredType === "float64" || resolvedType?.kind === "Float";

        if (isFloatContext && stmt.value.kind === "NumericLiteral" && !stmt.value.isFloat) {
          const value = this.transpileExpr(stmt.value);
          this.emitLine(`var ${this.goIdent(stmt.name)} float64 = ${value}`);
        } else {
          const value = this.transpileExpr(stmt.value);
          this.emitLine(`${this.goIdent(stmt.name)} := ${value}`);
        }
        this.emitDiscardIfUnused(stmt.name, rest);
        break;
      }

      case "ExpressionStatement": {
        const code = this.transpileExpr(stmt.expression);
        if (code.trim() !== "" && stmt.expression.kind !== "TryExpr") {
          this.emitLine(code);
        }
        break;
      }

      case "StructDeclaration":
        this.emitLine(`type ${this.goIdent(stmt.name)} struct {`);
        this.indent();
        for (const prop of stmt.properties) {
          // Campo exportado (maiúsculo): sem isso, json.Marshal/Unmarshal do Go
          // ignora silenciosamente o campo (reflection não enxerga não-exportado).
          // A tag preserva o nome original no JSON, igual ao modo interpretado.
          this.emitLine(
            `${this.goFieldName(prop.name)} ${this.transpileType(prop.typeAnnotation)} \`json:"${prop.name}"\``,
          );
        }
        this.dedent();
        this.emitLine(`}`);
        break;

      case "EnumDeclaration":
        this.transpileEnum(stmt);
        break;

      case "FunctionDeclaration":
        if (this.funcDepth === 0) {
          this.emitLine(
            `func ${this.goIdent(stmt.name)}(${this.transpileParams(stmt.parameters)})${this.suffixType(stmt)} {`,
          );
          this.indent();
          this.funcDepth++;
          this.transpileStmts(stmt.body.body);
          this.funcDepth--;
          this.dedent();
          this.emitLine(`}`);
        } else {
          // Go não tem função nomeada aninhada: viram closures.
          // A forma `var f func(...); f = func(...)` (em vez de `:=`) é a que
          // permite recursão, já que o nome existe antes do corpo ser atribuído.
          this.transpileNestedFunction(stmt, rest);
        }
        break;

      case "ImplDeclaration":
        // Em Go, métodos são anexados ao ponteiro da struct: func (self *Struct) Method()
        for (const method of stmt.methods) {
          this.emitLine(
            `func (self *${this.goIdent(stmt.structName)}) ${this.goIdent(method.name)}(${this.transpileParams(
              method.parameters,
            )})${this.suffixType(method)} {`,
          );
          this.indent();
          this.funcDepth++;
          this.transpileStmts(method.body.body);
          this.funcDepth--;
          this.dedent();
          this.emitLine(`}`);
        }
        break;

      case "TraitDeclaration":
        this.emitLine(`type ${this.goIdent(stmt.name)} interface {`);
        this.indent();
        for (const method of stmt.methods) {
          this.emitLine(
            `${this.goIdent(method.name)}(${this.transpileParams(method.parameters)})${this.suffixType(method)}`,
          );
        }
        this.dedent();
        this.emitLine(`}`);
        break;

      case "BlockStmt":
        this.transpileStmts(stmt.body);
        break;

      case "BreakStmt":
        this.emitLine(`break`);
        break;

      case "ContinueStmt":
        this.emitLine(`continue`);
        break;

      case "IfStmt": {
        this.transpileIfStmt(stmt);
        break;
      }

      case "ForStmt": {
        if (stmt.iterable.kind === "RangeExpr") {
          const start = this.transpileExpr(stmt.iterable.start);
          const end = this.nextTmp("end");
          const iterator = this.goIdent(stmt.iteratorName);
          this.emitLine(`${end} := ${this.transpileExpr(stmt.iterable.end)}`);
          if (stmt.indexName) {
            const idx = this.goIdent(stmt.indexName);
            this.emitLine(`${idx} := 0`);
            this.emitLine(`for ${iterator} := ${start}; ${iterator} < ${end}; ${iterator}++ {`);
            this.indent();
            this.transpileStmts(stmt.body.body);
            this.emitLine(`${idx}++`);
            this.dedent();
            this.emitLine(`}`);
          } else {
            this.emitLine(`for ${iterator} := ${start}; ${iterator} < ${end}; ${iterator}++ {`);
            this.indent();
            this.transpileStmts(stmt.body.body);
            this.dedent();
            this.emitLine(`}`);
          }
        } else {
          const target = this.transpileExpr(stmt.iterable);
          const iterator = this.goIdent(stmt.iteratorName);
          const iterableType = this.types.get(stmt.iterable);
          const isMap =
            iterableType?.kind === "Map" ||
            iterableType?.kind === "HashMap" ||
            stmt.iterable.kind === "MapLiteral";

          if (isMap) {
            if (stmt.indexName) {
              const val = this.goIdent(stmt.indexName);
              this.emitLine(`for ${iterator}, ${val} := range ${target} {`);
            } else {
              this.emitLine(`for ${iterator} := range ${target} {`);
            }
          } else {
            if (stmt.indexName) {
              const idx = this.goIdent(stmt.indexName);
              this.emitLine(`for ${idx}, ${iterator} := range ${target} {`);
            } else {
              this.emitLine(`for _, ${iterator} := range ${target} {`);
            }
          }
          this.indent();
          this.transpileStmts(stmt.body.body);
          this.dedent();
          this.emitLine(`}`);
        }
        break;
      }

      case "WhileStmt": {
        if (this.containsTry(stmt.condition)) {
          // `?` na condição precisa ser reavaliado a cada volta: o preâmbulo
          // gerado pelo `?` tem que ficar dentro do laço, não antes dele.
          this.emitLine(`for {`);
          this.indent();
          const condition = this.transpileExpr(stmt.condition);
          this.emitLine(`if !(${condition}) {`);
          this.indent();
          this.emitLine(`break`);
          this.dedent();
          this.emitLine(`}`);
          this.transpileStmts(stmt.body.body);
          this.dedent();
          this.emitLine(`}`);
        } else {
          const condition = this.transpileExpr(stmt.condition);
          this.emitLine(`for ${condition} {`);
          this.indent();
          this.transpileStmts(stmt.body.body);
          this.dedent();
          this.emitLine(`}`);
        }
        break;
      }

      case "ScopeStmt":
        // Concorrência estruturada via sync.WaitGroup
        this.goImports.add("sync");
        this.emitLine(`{`); // Escopo limpo em Go
        this.indent();
        this.emitLine(`var wg sync.WaitGroup`);
        // Aqui dentro, os spawn vão injetar código: eles procuram a WaitGroup
        // pai lexicalmente, que é exatamente como o Go resolve o nome `wg`.
        this.transpileStmts(stmt.body.body);
        this.emitLine(`wg.Wait()`);
        this.dedent();
        this.emitLine(`}`);
        break;

      case "SpawnStmt":
        this.goImports.add("sync");
        this.goImports.add("fmt");
        this.goImports.add("time");
        this.goImports.add("encoding/json");
        this.emitLine(`wg.Add(1)`);
        this.emitLine(`go func() {`);
        this.indent();
        this.emitLine(`defer wg.Done()`);
        this.emitLine(`defer func() {`);
        this.indent();
        this.emitLine(`if rec := recover(); rec != nil {`);
        this.indent();
        this.emitLine(`entry := map[string]any{`);
        this.emitLine(`  "level": "error",`);
        this.emitLine(`  "msg":   "panic in spawned task",`);
        this.emitLine(`  "panic": fmt.Sprintf("%v", rec),`);
        this.emitLine(`  "ts":    time.Now().Format(time.RFC3339),`);
        this.emitLine(`}`);
        this.emitLine(`out, _ := json.Marshal(entry)`);
        this.emitLine(`fmt.Println(string(out))`);
        this.dedent();
        this.emitLine(`}`);
        this.dedent();
        this.emitLine(`}()`);
        this.transpileStmts(stmt.body.body);
        this.dedent();
        this.emitLine(`}()`);
        break;

      case "ReturnStmt": {
        if (stmt.value) {
          const value = this.transpileExpr(stmt.value);
          this.emitLine(`return ${value}`);
        } else {
          this.emitLine(`return`);
        }
        break;
      }

      case "MatchStmt":
        this.transpileMatch(stmt);
        break;

      case "ImportDeclaration":
        // Tratado no cabeçalho, não emite nada aqui
        break;
    }
  }

  private transpileIfStmt(stmt: IfStmt, isElseIf = false): void {
    const condition = this.transpileExpr(stmt.condition);
    if (isElseIf) {
      this.emitLine(`} else if ${condition} {`);
    } else {
      this.emitLine(`if ${condition} {`);
    }
    this.indent();
    this.transpileStmts(stmt.consequent.body);
    this.dedent();
    if (stmt.alternate) {
      if (stmt.alternate.kind === "IfStmt") {
        this.transpileIfStmt(stmt.alternate, true);
        return;
      } else {
        this.emitLine(`} else {`);
        this.indent();
        this.transpileStmts(stmt.alternate.body);
        this.dedent();
      }
    }
    this.emitLine(`}`);
  }

  private transpileNestedFunction(stmt: FunctionDeclaration, rest: Stmt[]): void {
    const paramTypes = this.declaredParams(stmt.parameters).map((p) => this.transpileType(p.typeAnnotation));
    const name = this.goIdent(stmt.name);

    this.emitLine(`var ${name} func(${paramTypes.join(", ")})${this.suffixType(stmt)}`);
    this.emitLine(`${name} = func(${this.transpileParams(stmt.parameters)})${this.suffixType(stmt)} {`);
    this.indent();
    this.funcDepth++;
    this.transpileStmts(stmt.body.body);
    this.funcDepth--;
    this.dedent();
    this.emitLine(`}`);
    this.emitDiscardIfUnused(stmt.name, rest);
  }

  private transpileEnum(decl: EnumDeclaration): void {
    // Sum type idiomático em Go: interface marcadora + uma struct por variante.
    const enumName = this.goIdent(decl.name);
    const marker = `is${enumName}`;
    // Parâmetros de tipo (Result<T, E>) viram `any` no campo: uma única definição
    // Go serve a todas as instanciações, e a asserção acontece na extração.
    const typeParams = new Set(decl.typeParams ?? []);

    this.emitLine(`type ${enumName} interface{ ${marker}() }`);
    this.emitLine("");

    for (const variant of decl.variants) {
      const typeName = this.variantTypeName(decl.name, variant.name);
      const value = this.variantValueName(decl.name, variant.name);
      const payload = variant.payload ?? [];

      if (payload.length === 0) {
        this.emitLine(`type ${typeName} struct{}`);
        this.emitLine(`func (${typeName}) ${marker}() {}`);
        this.emitLine(`var ${value} ${enumName} = ${typeName}{}`);
      } else {
        const fields = payload.map((t, i) => `Field${i} ${this.transpileType(t, typeParams)}`).join("; ");
        const params = payload.map((t, i) => `f${i} ${this.transpileType(t, typeParams)}`).join(", ");
        const init = payload.map((_, i) => `Field${i}: f${i}`).join(", ");
        this.emitLine(`type ${typeName} struct{ ${fields} }`);
        this.emitLine(`func (${typeName}) ${marker}() {}`);
        this.emitLine(`func ${value}_new(${params}) ${enumName} { return ${typeName}{${init}} }`);
      }
      this.emitLine("");
    }
  }

  /**
   * Como extrair o campo `Field{index}` de uma variante: o tipo Go do valor e a
   * asserção necessária. Payload concreto (`Sucesso(String)`) já sai tipado do
   * campo; parâmetro de tipo (`Ok(T)`) sai como `any` e precisa da asserção para
   * o tipo daquela instanciação, que o checker resolveu.
   */
  private payloadAccess(
    decl: EnumDeclaration | undefined,
    payloadType: TypeNode | undefined,
    genericArgs: FlexType[],
  ): { goType: string; cast: string } {
    if (!payloadType) return { goType: "any", cast: "" };

    const params = decl?.typeParams ?? [];
    const position = payloadType.kind === "NamedTypeNode" ? params.indexOf(payloadType.name) : -1;
    if (position < 0) {
      return { goType: this.transpileType(payloadType), cast: "" };
    }

    const resolved = genericArgs[position];
    if (!resolved || resolved.kind === "Any" || resolved.kind === "Void") return { goType: "any", cast: "" };

    const goType = this.goType(resolved);
    if (!goType) return { goType: "any", cast: "" };
    return { goType, cast: `.(${goType})` };
  }

  /** Argumentos genéricos que o checker resolveu para o valor desta expressão. */
  private genericArgsOf(expr: Expr): FlexType[] {
    const type = this.types.get(expr);
    return type && type.kind === "Enum" ? type.genericArgs : [];
  }

  private transpileMatch(stmt: Extract<Stmt, { kind: "MatchStmt" }>): void {
    const subject = this.transpileExpr(stmt.value);
    const genericArgs = this.genericArgsOf(stmt.value);
    const hasBinders = stmt.arms.some((arm) => arm.binders.length > 0);
    const bound = this.nextTmp("m");

    // A exhaustiveness já foi validada pelo checker, então o switch não precisa
    // de `default` — todas as variantes do enum estão cobertas por construção.
    this.emitLine(hasBinders ? `switch ${bound} := ${subject}.(type) {` : `switch ${subject}.(type) {`);

    for (const arm of stmt.arms) {
      const decl = this.enums.get(arm.enumName);
      const payload = decl?.variants.find((v) => v.name === arm.variantName)?.payload ?? [];

      this.emitLine(`case ${this.variantTypeName(arm.enumName, arm.variantName, arm.binders.length)}:`);
      this.indent();
      for (let i = 0; i < arm.binders.length; i++) {
        const binder = arm.binders[i]!;
        const { cast } = this.payloadAccess(decl, payload[i], genericArgs);
        this.emitLine(`${this.goIdent(binder)} := ${bound}.Field${i}${cast}`);
        this.emitDiscardIfUnused(binder, arm.body.body);
      }
      this.transpileStmts(arm.body.body);
      this.dedent();
    }

    this.emitLine(`}`);
  }

  // =========== EXPRESSÕES ===========

  private transpileExpr(expr: Expr): string {
    switch (expr.kind) {
      case "NumericLiteral": {
        if (expr.isFloat) {
          const str = String(expr.value);
          return str.includes(".") || str.includes("e") || str.includes("E") ? str : `${str}.0`;
        }
        return String(expr.value);
      }
      case "BooleanLiteral":
        return expr.value ? "true" : "false";
      case "StringLiteral":
        return this.goString(expr.value);
      case "Identifier":
        return this.goIdent(expr.symbol);

      case "BinaryExpr":
      case "LogicalExpr": {
        const prec = this.binaryPrecedence(expr.operator);
        return `${this.operand(expr.left, prec, false)} ${expr.operator} ${this.operand(expr.right, prec, true)}`;
      }

      case "UnaryExpr":
        // Parênteses sempre: `--x` seria erro de sintaxe em Go, `-(-(x))` não.
        return `${expr.operator}(${this.transpileExpr(expr.argument)})`;

      case "AssignmentExpr":
        return `${this.transpileExpr(expr.assignee)} = ${this.transpileExpr(expr.value)}`;

      case "ArrayLiteral": {
        const type = this.types.get(expr);
        const elementType = type && type.kind === "Array" ? this.goType(type.elementType) : "any";
        return `[]${elementType}{${expr.elements.map((e) => this.transpileExpr(e)).join(", ")}}`;
      }

      case "IndexExpr":
        return `${this.transpileExpr(expr.object)}[${this.transpileExpr(expr.index)}]`;

      case "MemberExpr":
        // `Status.Pendente` (variante sem payload) é o singleton, não um acesso a campo
        if (expr.object.kind === "Identifier" && this.enums.has(expr.object.symbol)) {
          return this.variantValueName(expr.object.symbol, expr.property);
        }
        return `${this.transpileExpr(expr.object)}.${this.goMemberName(expr.object, expr.property)}`;

      case "CallExpr":
        return this.transpileCall(expr);

      case "MapLiteral": {
        const props = expr.properties.map((p) => `${this.goString(p.key)}: ${this.transpileExpr(p.value)}`);
        return `map[string]any{${props.join(", ")}}`;
      }

      case "RangeExpr": {
        const start = this.transpileExpr(expr.start);
        const end = this.transpileExpr(expr.end);
        return `func() []int { r := []int{}; for i := ${start}; i < ${end}; i++ { r = append(r, i) }; return r }()`;
      }

      case "StructExpr": {
        // Só structs do usuário (não tipos nativos como ServerConfig) usam campo
        // exportado — ver `goFieldName`/StructDeclaration.
        const isUserStruct = this.structNames.has(expr.structName);
        const props = expr.properties
          .map((p) => `${isUserStruct ? this.goFieldName(p.name) : this.goIdent(p.name)}: ${this.transpileExpr(p.value)}`)
          .join(", ");
        return `&${this.goIdent(expr.structName)}{${props}}`;
      }

      case "StringInterpolationExpr":
        this.goImports.add("fmt");
        return expr.parts
          .map((p) => (typeof p === "string" ? this.goString(p) : `fmt.Sprint(${this.transpileExpr(p)})`))
          .join(" + ");

      case "TryExpr":
        return this.transpileTry(expr);

      case "LambdaExpr": {
        // Lambda vira closure literal em Go: func(params) ReturnType { body }
        const retType = this.types.get(expr);
        const retSuffix = retType && retType.kind !== "Void" ? ` ${this.goType(retType)}` : "";
        const params = expr.parameters
          .map((p) => {
            const pTypeNode = p.typeAnnotation;
            let typeStr = this.transpileType(pTypeNode);
            if (typeStr === "any") {
              const inferred = (p as any).__inferredType ? this.goType((p as any).__inferredType) : "any";
              typeStr = inferred;
            }
            return `${this.goIdent(p.name)} ${typeStr}`;
          })
          .join(", ");
        const bodyCode = this.capture(() => {
          this.funcDepth++;
          this.transpileStmts(expr.body.body);
          this.funcDepth--;
        });
        // Emitido inline — quem consome (ex: transpileCall) envolve na chamada
        return `func(${params})${retSuffix} {\n${bodyCode}${"  ".repeat(this.indentLevel)}}`;
      }
    }
  }

  private transpileCall(expr: Extract<Expr, { kind: "CallExpr" }>): string {
    if (expr.caller.kind === "MemberExpr") {
      const member = expr.caller;

      const objType = this.types.get(member.object);
      const isStructWithMethod =
        objType &&
        objType.kind === "Struct" &&
        this.nativeTypes.get(objType.name)?.methods?.some((m) => m.name === member.property);

      if (member.property === "to_string" && !isStructWithMethod) {
        const obj = this.transpileExpr(member.object);
        if (objType?.kind === "Int" || member.object.kind === "NumericLiteral") {
          this.goImports.add("strconv");
          return `strconv.Itoa(${obj})`;
        }
        if (objType?.kind === "Float") {
          this.goImports.add("strconv");
          return `strconv.FormatFloat(${obj}, 'f', -1, 64)`;
        }
        if (objType?.kind === "Bool" || member.object.kind === "BooleanLiteral") {
          this.goImports.add("strconv");
          return `strconv.FormatBool(${obj})`;
        }
        this.goImports.add("fmt");
        return `fmt.Sprint(${obj})`;
      }
      if (member.property === "to_float" && !isStructWithMethod) {
        return `float64(${this.transpileExpr(member.object)})`;
      }
      if (member.property === "to_int" && !isStructWithMethod) {
        return `int(${this.transpileExpr(member.object)})`;
      }

      // Métodos de String (RFC-019)
      const isStringMethod =
        objType?.kind === "String" ||
        member.object.kind === "StringLiteral" ||
        member.object.kind === "StringInterpolationExpr";

      if (isStringMethod) {
        const obj = this.transpileExpr(member.object);
        switch (member.property) {
          case "len":
            return `len([]rune(${obj}))`;
          case "contains":
            this.goImports.add("strings");
            return `strings.Contains(${obj}, ${this.transpileExpr(expr.args[0])})`;
          case "starts_with":
            this.goImports.add("strings");
            return `strings.HasPrefix(${obj}, ${this.transpileExpr(expr.args[0])})`;
          case "ends_with":
            this.goImports.add("strings");
            return `strings.HasSuffix(${obj}, ${this.transpileExpr(expr.args[0])})`;
          case "to_upper":
            this.goImports.add("strings");
            return `strings.ToUpper(${obj})`;
          case "to_lower":
            this.goImports.add("strings");
            return `strings.ToLower(${obj})`;
          case "trim":
            this.goImports.add("strings");
            return `strings.TrimSpace(${obj})`;
          case "split":
            this.goImports.add("strings");
            return `strings.Split(${obj}, ${this.transpileExpr(expr.args[0])})`;
          case "replace":
            this.goImports.add("strings");
            return `strings.ReplaceAll(${obj}, ${this.transpileExpr(expr.args[0])}, ${this.transpileExpr(expr.args[1])})`;
          case "substring": {
            const start = this.transpileExpr(expr.args[0]);
            const end = this.transpileExpr(expr.args[1]);
            return `string([]rune(${obj})[${start}:${end}])`;
          }
          case "index_of": {
            this.goImports.add("strings");
            this.usedBuiltins.add("Option");
            this.usedStringHelpers = true;
            return `flex_string_index_of(${obj}, ${this.transpileExpr(expr.args[0])})`;
          }
        }
      }

      // Métodos de Array (RFC-020)
      if (objType?.kind === "Array" || member.object.kind === "ArrayLiteral") {
        const obj = this.transpileExpr(member.object);
        const elemType = objType && objType.kind === "Array" ? objType.elementType : { kind: "Any" } as FlexType;
        const elemGoType = this.goType(elemType);

        switch (member.property) {
          case "len":
            return `len(${obj})`;
          case "is_empty":
            return `(len(${obj}) == 0)`;
          case "contains":
            return `func() bool { for _, __item := range ${obj} { if __item == ${this.transpileExpr(expr.args[0])} { return true } }; return false }()`;
          case "slice":
            return `${obj}[${this.transpileExpr(expr.args[0])}:${this.transpileExpr(expr.args[1])}]`;
          case "concat":
            return `append(append([]${elemGoType}{}, ${obj}...), ${this.transpileExpr(expr.args[0])}...)`;
          case "push":
            return `${obj} = append(${obj}, ${this.transpileExpr(expr.args[0])})`;
          case "pop":
            this.usedBuiltins.add("Option");
            return `func() Option { if len(${obj}) == 0 { return Option_None }; __last := ${obj}[len(${obj})-1]; ${obj} = ${obj}[:len(${obj})-1]; return Option_Some_new(__last) }()`;
          case "sort":
            this.goImports.add("sort");
            return `sort.Slice(${obj}, func(__i, __j int) bool { return ${obj}[__i] < ${obj}[__j] })`;
          case "map": {
            const resType = this.types.get(expr);
            const resElemType = resType && resType.kind === "Array" ? this.goType(resType.elementType) : "any";
            return `func() []${resElemType} {\n  __fn := ${this.transpileExpr(expr.args[0])}\n  __res := []${resElemType}{}\n  for _, __item := range ${obj} {\n    __res = append(__res, __fn(__item))\n  }\n  return __res\n}()`;
          }
          case "filter":
            return `func() []${elemGoType} {\n  __fn := ${this.transpileExpr(expr.args[0])}\n  __res := []${elemGoType}{}\n  for _, __item := range ${obj} {\n    if __fn(__item) {\n      __res = append(__res, __item)\n    }\n  }\n  return __res\n}()`;
          case "find":
            this.usedBuiltins.add("Option");
            return `func() Option {\n  __fn := ${this.transpileExpr(expr.args[0])}\n  for _, __item := range ${obj} {\n    if __fn(__item) {\n      return Option_Some_new(__item)\n    }\n  }\n  return Option_None\n}()`;
          case "for_each":
            return `func() {\n  __fn := ${this.transpileExpr(expr.args[0])}\n  for _, __item := range ${obj} {\n    __fn(__item)\n  }\n}()`;
        }
      }

      // Métodos de HashMap (RFC-023)
      const isMapMethod =
        objType?.kind === "HashMap" ||
        objType?.kind === "Map" ||
        member.object.kind === "MapLiteral";

      if (isMapMethod) {
        const obj = this.transpileExpr(member.object);
        const keyGoType =
          objType && objType.kind === "HashMap" ? this.goType(objType.keyType) : "string";
        const valGoType =
          objType && objType.kind === "HashMap" ? this.goType(objType.valueType) : "any";

        switch (member.property) {
          case "len":
            return `len(${obj})`;
          case "is_empty":
            return `(len(${obj}) == 0)`;
          case "get":
            this.usedBuiltins.add("Option");
            return `func() Option {\n  __v, __ok := ${obj}[${this.transpileExpr(expr.args[0])}]\n  if !__ok {\n    return Option_None\n  }\n  return Option_Some_new(__v)\n}()`;
          case "set":
            return `${obj}[${this.transpileExpr(expr.args[0])}] = ${this.transpileExpr(expr.args[1])}`;
          case "remove":
            this.usedBuiltins.add("Option");
            return `func() Option {\n  __v, __ok := ${obj}[${this.transpileExpr(expr.args[0])}]\n  if !__ok {\n    return Option_None\n  }\n  delete(${obj}, ${this.transpileExpr(expr.args[0])})\n  return Option_Some_new(__v)\n}()`;
          case "contains_key":
            return `func() bool {\n  _, __ok := ${obj}[${this.transpileExpr(expr.args[0])}]\n  return __ok\n}()`;
          case "keys":
            return `func() []${keyGoType} {\n  __keys := []${keyGoType}{}\n  for __k := range ${obj} {\n    __keys = append(__keys, __k)\n  }\n  return __keys\n}()`;
          case "values":
            return `func() []${valGoType} {\n  __vals := []${valGoType}{}\n  for _, __v := range ${obj} {\n    __vals = append(__vals, __v)\n  }\n  return __vals\n}()`;
        }
      }

      // Construtores estáticos de HashMap (RFC-023)
      if (member.object.kind === "Identifier" && member.object.symbol === "HashMap") {
        if (member.property === "new") {
          const mapType = this.types.get(expr);
          const goMapType =
            mapType && mapType.kind === "HashMap" ? this.goType(mapType) : "map[string]any";
          return `make(${goMapType})`;
        }
        if (member.property === "from") {
          return `${this.transpileExpr(expr.args[0])}`;
        }
      }

      // Construtor de variante de enum: Status.Sucesso("msg") -> Status_Sucesso_new("msg")
      if (member.object.kind === "Identifier" && this.enums.has(member.object.symbol)) {
        const args = expr.args.map((a) => this.transpileExpr(a)).join(", ");
        return `${this.variantValueName(member.object.symbol, member.property)}_new(${args})`;
      }

      // Construtor estático de módulo nativo: `Server.new(x)` -> `NewServer(x)`,
      // `Pool.connect(x)` -> `Pool_connect(x)`
      if (member.object.kind === "Identifier") {
        const isStatic = this.nativeTypes
          .get(member.object.symbol)
          ?.statics?.some((s) => s.name === member.property);
        if (isStatic && member.property === "new") {
          const args = expr.args.map((a) => this.transpileExpr(a)).join(", ");
          return `New${member.object.symbol}(${args})`;
        }
        if (isStatic) {
          const args = expr.args.map((a) => this.transpileExpr(a)).join(", ");
          return `${member.object.symbol}_${member.property}(${args})`;
        }
      }

      // `req.json()` -> `DecodeJSON[T](req)` (RFC-004): Go não tem método
      // genérico, então o parâmetro de tipo que o checker resolveu para esta
      // chamada (o `T` de `Result<T, String>`) vira o argumento de tipo de uma
      // função livre. Sem tipo resolvido (contexto não anotado), decodifica em `any`.
      if (member.property === "json" && expr.args.length === 0) {
        const objType = this.types.get(member.object);
        if (objType?.kind === "Struct" && objType.name === "Request") {
          const resultType = this.types.get(expr);
          const payload = resultType?.kind === "Enum" ? resultType.genericArgs[0] : undefined;
          const goT = payload ? this.goType(payload) : "any";
          return `DecodeJSON[${goT}](${this.transpileExpr(member.object)})`;
        }
      }

      // Channel é primitivo da linguagem, não vem de módulo: vira `chan` do Go
      if (member.object.kind === "Identifier" && member.object.symbol === "Channel" && member.property === "new") {
        const type = this.types.get(expr);
        const element =
          type && type.kind === "Struct" && type.genericArgs[0] ? this.goType(type.genericArgs[0]) : "any";
        return `make(chan ${element})`;
      }

      // Translate Channel method calls to Go operators
      if (member.property === "send" && expr.args[0]) {
        return `${this.transpileExpr(member.object)} <- ${this.transpileExpr(expr.args[0]!)}`;
      } else if (member.property === "recv") {
        return `<-${this.transpileExpr(member.object)}`;
      }

      // Método de instância de módulo nativo: `pool.query(sql, params)`
      if (objType && objType.kind === "Struct") {
        const nativeType = this.nativeTypes.get(objType.name);
        const methodSig = nativeType?.methods?.find((m) => m.name === member.property);
        if (methodSig) {
          const args = expr.args
            .map((a) => {
              if (a.kind === "ArrayLiteral") {
                return `[]any{${a.elements.map((e) => this.transpileExpr(e)).join(", ")}}`;
              }
              return this.transpileExpr(a);
            })
            .join(", ");
          return `${this.transpileExpr(member.object)}.${member.property}(${args})`;
        }
      }
    }

      if (expr.caller.kind === "Identifier") {
        if (expr.caller.symbol === "parse_int") {
          this.goImports.add("strconv");
          this.usedBuiltins.add("Result");
          this.usedParseIntHelper = true;
          return `flex_parse_int(${this.transpileExpr(expr.args[0])})`;
        }
        if (expr.caller.symbol === "parse_float") {
          this.goImports.add("strconv");
          this.usedBuiltins.add("Result");
          this.usedParseFloatHelper = true;
          return `flex_parse_float(${this.transpileExpr(expr.args[0])})`;
        }
      }

      const args = expr.args.map((a) => this.transpileExpr(a)).join(", ");
      return `${this.transpileExpr(expr.caller)}(${args})`;
  }

  /**
   * `?` vira uma checagem explícita de erro no fluxo em que aparece: o preâmbulo
   * (temporário + type-switch) é emitido antes do statement que contém o `?`, e a
   * expressão em si passa a ser o temporário com o payload da variante de sucesso.
   */
  private transpileTry(expr: Extract<Expr, { kind: "TryExpr" }>): string {
    const inner = this.transpileExpr(expr.expression);
    const enumDecl = this.enumOf(expr.expression);

    if (!enumDecl) {
      throw new Error(
        "TranspileError: cannot resolve the Result/Option behind the '?' operator (missing type information)",
      );
    }

    // A variante de sucesso é a primeira declarada — Ok/Some, por construção.
    const okVariant = successVariant(enumDecl)!;
    const tmp = this.nextTmp("try");
    const bound = this.nextTmp("tv");
    const caseType = this.variantTypeName(enumDecl.name, okVariant.name);
    const payload = okVariant.payload ?? [];

    this.emitLine(`${tmp} := ${inner}`);

    if (payload.length === 0) {
      this.emitLine(`switch ${tmp}.(type) {`);
      this.emitLine(`case ${caseType}:`);
      this.emitLine(`default:`);
      this.indent();
      this.emitPropagation(tmp);
      this.dedent();
      this.emitLine(`}`);
      return ""; // variante de sucesso sem payload não produz valor utilizável
    }

    const value = `${tmp}_v`;
    const access = this.payloadAccess(enumDecl, payload[0], this.genericArgsOf(expr.expression));
    this.emitLine(`var ${value} ${access.goType}`);
    this.emitLine(`switch ${bound} := ${tmp}.(type) {`);
    this.emitLine(`case ${caseType}:`);
    this.indent();
    this.emitLine(`${value} = ${bound}.Field0${access.cast}`);
    this.dedent();
    this.emitLine(`default:`);
    this.indent();
    this.emitPropagation(tmp);
    this.dedent();
    this.emitLine(`}`);
    this.emitLine(`_ = ${value}`);
    return value;
  }

  private emitPropagation(tmp: string): void {
    if (this.funcDepth > 0) {
      this.emitLine(`return ${tmp}`); // propaga o Err como está
    } else {
      // No topo do programa não há função para onde propagar; o interpretador
      // também aborta nesse caso (ReturnException sem função envolvente).
      this.emitLine(`panic("RuntimeError: '?' propagated outside of a function")`);
    }
  }

  // =========== TIPOS ===========

  /**
   * @param typeParams nomes que são parâmetros de tipo no contexto atual (T, E):
   *                   viram `any`, já que a definição Go é única por enum.
   */
  private transpileType(typeNode: TypeNode, typeParams?: Set<string>): string {
    if (typeNode.kind === "NamedTypeNode") {
      if (typeParams?.has(typeNode.name)) return "any";
      switch (typeNode.name) {
        case "Int":
          return "int";
        case "Float":
          return "float64";
        case "String":
          return "string";
        case "Bool":
          return "bool";
        case "HashMap":
        case "Map":
          return "map[string]any";
        case "Any":
          return "any";
        case "Void":
          return ""; // Go representa "sem retorno" pela ausência do tipo
        default:
          if (this.enums.has(typeNode.name) || this.traitNames.has(typeNode.name)) {
            this.markBuiltinUse(typeNode.name);
            return this.goIdent(typeNode.name); // interface (sum type ou trait)
          }
          if (this.structNames.has(typeNode.name)) {
            return `*${this.goIdent(typeNode.name)}`; // structs FlexLang são sempre valores por referência
          }
          if (this.nativeTypes.get(typeNode.name)?.goPointer) {
            return `*${typeNode.name}`; // tipo nativo que precisa de semântica de referência (ex: Response)
          }
          return typeNode.name; // tipo injetado pela stdlib (Request, Response, ...)
      }
    }
    if (typeNode.kind === "ArrayTypeNode") {
      return `[]${this.transpileType(typeNode.elementType, typeParams)}`;
    }
    if (typeNode.kind === "GenericTypeNode") {
      if (typeNode.name === "HashMap" || typeNode.name === "Map") {
        const k = typeNode.typeArguments[0]
          ? this.transpileType(typeNode.typeArguments[0], typeParams)
          : "string";
        const v = typeNode.typeArguments[1]
          ? this.transpileType(typeNode.typeArguments[1], typeParams)
          : "any";
        return `map[${k}]${v}`;
      }
      if (typeNode.name === "Channel") {
        return `chan ${typeNode.typeArguments[0] ? this.transpileType(typeNode.typeArguments[0], typeParams) : "any"}`;
      }
      if (this.enums.has(typeNode.name)) {
        // Uma definição Go por enum serve a todas as instanciações:
        // Result<Int, String> transpila para a interface Result.
        this.markBuiltinUse(typeNode.name);
        return this.goIdent(typeNode.name);
      }
      return `any /* generic ${typeNode.name} */`;
    }
    return "any";
  }

  /** Converte um tipo já resolvido pelo checker no tipo Go correspondente. */
  private goType(type: FlexType): string {
    switch (type.kind) {
      case "Int":
        return "int";
      case "Float":
        return "float64";
      case "String":
        return "string";
      case "Bool":
        return "bool";
      case "Void":
        return "";
      case "Any":
        return "any";
      case "Array":
        return `[]${this.goType(type.elementType)}`;
      case "HashMap":
        return `map[${this.goType(type.keyType)}]${this.goType(type.valueType)}`;
      case "Map":
        return "map[string]any";
      case "Enum":
        this.markBuiltinUse(type.name);
        return this.goIdent(type.name);
      case "Struct":
        if (type.name === "Channel") {
          return `chan ${type.genericArgs[0] ? this.goType(type.genericArgs[0]) : "any"}`;
        }
        if (this.structNames.has(type.name)) return `*${this.goIdent(type.name)}`;
        if (this.nativeTypes.get(type.name)?.goPointer) return `*${type.name}`;
        return type.name;
    }
  }

  private transpileParams(parameters: Parameter[]): string {
    return this.declaredParams(parameters)
      .map((p) => `${this.goIdent(p.name)} ${this.transpileType(p.typeAnnotation)}`.trimEnd())
      .join(", ");
  }

  /** `self` é o receiver do método em Go, não um parâmetro. */
  private declaredParams(parameters: Parameter[]): Parameter[] {
    return parameters.filter((p) => p.name !== "self");
  }

  /** Tipo de retorno já pronto para concatenar depois da lista de parâmetros. */
  private suffixType(fn: { returnType?: TypeNode | undefined }): string {
    const type = fn.returnType ? this.transpileType(fn.returnType) : "";
    return type === "" ? "" : ` ${type}`;
  }

  /**
   * Nome base de uma variante: `Status_Sucesso`. É o singleton (variante sem
   * payload) ou o prefixo do construtor `_new` (variante com payload).
   */
  private variantValueName(enumName: string, variantName: string): string {
    this.markBuiltinUse(enumName);
    return `${this.goIdent(enumName)}_${this.goIdent(variantName)}`;
  }

  /** Marca um tipo embutido como referenciado, para o cabeçalho emiti-lo. */
  private markBuiltinUse(name: string): void {
    if (isBuiltinType(name)) this.usedBuiltins.add(name);
  }

  /**
   * Nome Go do tipo de uma variante. Variantes sem payload ganham sufixo `_t`
   * porque o nome sem sufixo é usado pela instância singleton.
   */
  private variantTypeName(enumName: string, variantName: string, binderCount?: number): string {
    const declared = this.enums.get(enumName)?.variants.find((v) => v.name === variantName);
    const hasPayload = declared ? (declared.payload?.length ?? 0) > 0 : (binderCount ?? 0) > 0;
    const base = this.variantValueName(enumName, variantName);
    return hasPayload ? base : `${base}_t`;
  }

  private enumOf(expr: Expr): EnumDeclaration | undefined {
    const type = this.types.get(expr);
    if (type && type.kind === "Enum") {
      return this.enums.get(type.name);
    }
    return undefined;
  }

  private goString(value: string): string {
    return JSON.stringify(value);
  }

  /** Nome Go seguro para um identificador FlexLang (ver GO_RESERVED). */
  private goIdent(name: string): string {
    return GO_RESERVED.has(name) ? `flex_${name}` : name;
  }

  /** Primeira letra maiúscula: convenção Go para campo exportado. */
  private goFieldName(name: string): string {
    return name.length === 0 ? name : name[0]!.toUpperCase() + name.slice(1);
  }

  /**
   * Nome Go de `objectExpr.property`: capitalizado SE `property` é um campo
   * conhecido de um struct do usuário (ver `goFieldName`); do contrário
   * (chamada de método, tipo nativo, tipo não resolvido) mantém minúsculo — é
   * o mesmo `MemberExpr` que renderiza tanto o alvo de uma chamada de método
   * (`self.speak()`) quanto uma leitura de campo (`self.name`), e só o segundo
   * caso passa por `encoding/json` no Go.
   */
  private goMemberName(objectExpr: Expr, property: string): string {
    const objType = this.types.get(objectExpr);
    if (objType?.kind === "Struct") {
      const decl = this.structDecls.get(objType.name);
      if (decl?.properties.some((p) => p.name === property)) {
        return this.goFieldName(property);
      }
    }
    return this.goIdent(property);
  }

  // =========== PRECEDÊNCIA ===========

  private binaryPrecedence(operator: string): number {
    switch (operator) {
      case "||":
        return 1;
      case "&&":
        return 2;
      case "==":
      case "!=":
      case "<":
      case "<=":
      case ">":
      case ">=":
        return 3;
      case "+":
      case "-":
        return 4;
      case "*":
      case "/":
      case "%":
        return 5;
      default:
        return 6;
    }
  }

  private exprPrecedence(expr: Expr): number {
    if (expr.kind === "BinaryExpr" || expr.kind === "LogicalExpr") return this.binaryPrecedence(expr.operator);
    if (expr.kind === "StringInterpolationExpr" && expr.parts.length > 1) return 4; // vira uma cadeia de `+`
    return 100; // átomos: literais, identificadores, chamadas, indexações, unários
  }

  /**
   * A AST já carrega a precedência na sua forma; parênteses são reintroduzidos
   * só onde a forma da árvore diverge da precedência natural do Go
   * (ex: `(x + y) * 2`, que sem parênteses viraria `x + y * 2`).
   */
  private operand(expr: Expr, parentPrecedence: number, isRight: boolean): string {
    const code = this.transpileExpr(expr);
    const precedence = this.exprPrecedence(expr);
    if (precedence < parentPrecedence || (isRight && precedence === parentPrecedence)) {
      return `(${code})`;
    }
    return code;
  }

  // =========== USO DE VARIÁVEIS ===========

  /**
   * Em Go, variável local declarada e nunca lida é erro de compilação — o que é
   * legal em FlexLang. Quando o nome não é lido, emitimos `_ = nome`.
   */
  private emitDiscardIfUnused(name: string, rest: Stmt[]): void {
    if (this.funcDepth === 0) return;
    if (!this.isUsedIn(rest, name)) {
      this.emitLine(`_ = ${this.goIdent(name)}`);
    }
  }

  private isUsedIn(stmts: Stmt[], name: string): boolean {
    let used = false;
    const visit = (expr: Expr) => {
      if (expr.kind === "Identifier" && expr.symbol === name) used = true;
    };
    for (const stmt of stmts) this.walkStmt(stmt, visit);
    return used;
  }

  private containsTry(expr: Expr): boolean {
    let found = false;
    this.walkExpr(expr, (e) => {
      if (e.kind === "TryExpr") found = true;
    });
    return found;
  }

  private walkStmt(stmt: Stmt, visit: (expr: Expr) => void): void {
    const walkAll = (stmts: Stmt[]) => stmts.forEach((s) => this.walkStmt(s, visit));

    switch (stmt.kind) {
      case "VarDeclaration":
      case "PrintStmt":
        this.walkExpr(stmt.value, visit);
        break;
      case "ExpressionStatement":
        this.walkExpr(stmt.expression, visit);
        break;
      case "ReturnStmt":
        if (stmt.value) this.walkExpr(stmt.value, visit);
        break;
      case "IfStmt":
        this.walkExpr(stmt.condition, visit);
        walkAll(stmt.consequent.body);
        if (stmt.alternate) {
          if (stmt.alternate.kind === "IfStmt") {
            this.walkStmt(stmt.alternate, visit);
          } else {
            walkAll(stmt.alternate.body);
          }
        }
        break;
      case "BreakStmt":
      case "ContinueStmt":
        break;
      case "WhileStmt":
        this.walkExpr(stmt.condition, visit);
        walkAll(stmt.body.body);
        break;
      case "ForStmt":
        this.walkExpr(stmt.iterable, visit);
        walkAll(stmt.body.body);
        break;
      case "BlockStmt":
        walkAll(stmt.body);
        break;
      case "ScopeStmt":
        if (stmt.deadline) this.walkExpr(stmt.deadline, visit);
        walkAll(stmt.body.body);
        break;
      case "SpawnStmt":
        walkAll(stmt.body.body);
        break;
      case "MatchStmt":
        this.walkExpr(stmt.value, visit);
        stmt.arms.forEach((arm) => walkAll(arm.body.body));
        break;
      case "FunctionDeclaration":
        walkAll(stmt.body.body);
        break;
      case "ImplDeclaration":
        stmt.methods.forEach((m) => walkAll(m.body.body));
        break;
      default:
        break;
    }
  }

  private walkExpr(expr: Expr, visit: (expr: Expr) => void): void {
    visit(expr);
    switch (expr.kind) {
      case "BinaryExpr":
      case "LogicalExpr":
        this.walkExpr(expr.left, visit);
        this.walkExpr(expr.right, visit);
        break;
      case "UnaryExpr":
        this.walkExpr(expr.argument, visit);
        break;
      case "AssignmentExpr":
        this.walkExpr(expr.assignee, visit);
        this.walkExpr(expr.value, visit);
        break;
      case "CallExpr":
        this.walkExpr(expr.caller, visit);
        expr.args.forEach((a) => this.walkExpr(a, visit));
        break;
      case "MemberExpr":
        this.walkExpr(expr.object, visit);
        break;
      case "IndexExpr":
        this.walkExpr(expr.object, visit);
        this.walkExpr(expr.index, visit);
        break;
      case "ArrayLiteral":
        expr.elements.forEach((e) => this.walkExpr(e, visit));
        break;
      case "StructExpr":
        expr.properties.forEach((p) => this.walkExpr(p.value, visit));
        break;
      case "MapLiteral":
        expr.properties.forEach((p) => this.walkExpr(p.value, visit));
        break;
      case "RangeExpr":
        this.walkExpr(expr.start, visit);
        this.walkExpr(expr.end, visit);
        break;
      case "StringInterpolationExpr":
        expr.parts.forEach((p) => {
          if (typeof p !== "string") this.walkExpr(p, visit);
        });
        break;
      case "TryExpr":
        this.walkExpr(expr.expression, visit);
        break;
      case "LambdaExpr":
        for (const s of expr.body.body) this.walkStmt(s, visit);
        break;
      default:
        break;
    }
  }
}
