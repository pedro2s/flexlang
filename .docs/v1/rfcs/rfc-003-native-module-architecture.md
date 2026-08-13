# RFC-003: Arquitetura Mínima de Módulos Nativos

> **Status:** Draft · **Prioridade:** P1 (enabler) · **Depende de:** RFC-001, RFC-002
> **Bloqueia:** RFC-004, RFC-005 · **Relacionado:** Seção 7 do [roadmap arquitetural](../../flexlang_architecture_roadmap.md) (versão completa, pós-v1.0)

## Resumo

`"net/http"` é reconhecido hoje por comparação literal de string dentro de `checker.ts` (linha 74) e `transpiler.ts` (linha 36) — três `if`s espalhados por três motores diferentes. A v1.0 introduz um **segundo** módulo nativo (PostgreSQL, RFC-005); sem uma costura mínima, isso vira seis `if`s, e o próximo depois disso, nove. Esta RFC entrega **só o suficiente** para os dois módulos da v1.0 não duplicarem o hack — não é a arquitetura de plugins completa da Seção 7 do roadmap (essa fica para pós-v1.0, quando houver de fato terceiros contribuindo).

## Motivação

Ver "Estado Atual — Lacuna 7" no roadmap arquitetural. Esta RFC é o recorte mínimo dessa lacuna que a v1.0 precisa, não a solução completa.

## Não-objetivos (importante — este é o recorte deliberadamente pequeno)

- **Não** suporta carregamento dinâmico de módulos de terceiros (plugins compilados, `.so`/pacotes npm-like). Só os módulos que o próprio time da FlexLang escreve e compila junto com o compilador.
- **Não** inclui sistema de permissões/capabilities por módulo.
- **Não** resolve o problema geral de "generics em qualquer struct nativa" — cada módulo declara seus tipos concretos.

Se a v1.0 só precisa de 2 módulos (`net/http`, `db/postgres`), a pergunta certa não é "como suportar infinitos módulos de terceiros" — é "como não repetir se/então três vezes por módulo que eu mesmo escrevo". É isso que esta RFC resolve.

## Design Detalhado

### Interface `NativeModule`

```ts
// src/modules/types.ts
export interface NativeModule {
  path: string; // "net/http", "db/postgres"

  // O que o TypeChecker deve pré-registrar no Pass 1 (substitui os
  // structs.set("Server", ...) manuais de checker.ts:74-81)
  typeSurface: {
    structs: StructDeclaration[];
    // assinaturas de método por struct, para o checker validar chamadas
    // (net/http e Postgres hoje não validam argumentos de métodos nativos
    // além de contagem — ver checker.ts:430-469 — isso continua uma
    // limitação conhecida, não uma regressão desta RFC)
  };

  // Fábrica do binding em modo interpretado (substitui o
  // "if expr.caller.object.symbol === 'Server'" hardcoded em interpreter.ts:359)
  runtimeBinding: (interpreter: Interpreter) => Record<string, any>;

  // O que o transpiler injeta quando o módulo é importado (substitui
  // o bloco condicional de transpiler.ts:36-54)
  goCodegen: {
    imports: string[];
    boilerplate: string;
  };
}
```

### `ModuleRegistry`

```ts
// src/modules/registry.ts
export class ModuleRegistry {
  private modules = new Map<string, NativeModule>();
  register(mod: NativeModule) { this.modules.set(mod.path, mod); }
  get(path: string): NativeModule | undefined { return this.modules.get(path); }
}

export const registry = new ModuleRegistry();
registry.register(httpModule);     // src/modules/http.ts
registry.register(postgresModule); // src/modules/postgres.ts
```

### Pontos de integração (as três mudanças reais no core)

1. `checker.ts` Pass 1 (linha ~73-81): o `if (stmt.moduleName === "\"net/http\"") { ... } else { throw ... }` vira `const mod = registry.get(stripQuotes(stmt.moduleName)); if (!mod) throw ImportError; mod.typeSurface.structs.forEach(s => this.structs.set(s.name, s));`
2. `interpreter.ts` (linha ~356-362, dentro de `CallExpr`): o par de `if` para `Channel.new`/`Server.new` vira uma consulta ao binding do módulo correspondente à declaração de import processada no início do `run()`.
3. `transpiler.ts` (linha ~36-54): o `if (this.importedModules.has("\"net/http\""))` vira um loop sobre `this.importedModules`, resolvendo cada um via `registry.get()` e emitindo `imports`/`boilerplate`.

Nenhuma dessas mudanças altera comportamento observável — é uma refatoração pura, validável 100% pelos golden tests existentes (nenhum `.out` deve mudar).

## Plano de Testes

- Todos os testes existentes (`tests/*.flex`) devem passar sem alteração de `.out` — esta RFC é uma refatoração interna, não uma mudança de linguagem.
- Novo teste: registrar um módulo nativo fictício mínimo (ex: `"test/echo"`) só para os testes automatizados, confirmando que o registro/consulta funciona sem precisar ser `net/http` ou `db/postgres`.

## Critério de Aceite

- [ ] `checker.ts`, `interpreter.ts` e `transpiler.ts` não têm mais nenhuma comparação literal `moduleName === "\"net/http\""` — tudo passa por `registry.get()`.
- [ ] `net/http` (RFC-004) e `db/postgres` (RFC-005) são implementados como `NativeModule`, não como casos especiais.
- [ ] Todos os golden tests preexistentes continuam passando sem alteração de `.out`.

## Riscos e Alternativas Consideradas

- **Alternativa descartada**: pular esta RFC e simplesmente copiar o padrão de `if` do `net/http` para o Postgres. Rejeitada porque triplicaria o débito técnico já identificado como Lacuna 7, exatamente no momento (adicionar o 2º módulo) em que o custo de not fazer a costura fica mais barato do que vai ficar depois.
- **Risco**: escopo insuficiente para o dia em que a Seção 7 completa (plugins de terceiros) for necessária. Aceito deliberadamente — esta RFC não tenta prever esse futuro, só evita repetir o hack duas vezes.
