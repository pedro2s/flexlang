# RFC-006: Sistema de Módulos Locais (Multi-arquivo)

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** nada (pode andar em paralelo às RFC-001/002)
> **Relacionado:** Seção 8, Estágio A do [roadmap arquitetural](../../flexlang_architecture_roadmap.md) (esta RFC é a implementação desse estágio)

## Resumo

Hoje a FlexLang só executa **um único arquivo** por vez — `flex run arquivo.flex` (`cli.ts:36`) lê um arquivo, tokeniza, parseia e roda; não existe nenhuma resolução de `import` entre arquivos `.flex` locais (o `ImportDeclaration` só é usado hoje para `"net/http"`, um módulo nativo). Um projeto de API real (o caso de uso de referência do PRD) precisa separar `routes/`, `models/` e `repository/` em arquivos distintos. Sem isso, a v1.0 força todo projeto real a viver em um único arquivo gigante — inviável para produção.

## Motivação

Nenhum time escreve uma API de produção em um arquivo só. Isso não é uma conveniência — é um pré-requisito estrutural para o caso de uso de referência do PRD (Seção 2) ser sequer escrito de forma legível.

## Não-objetivos

- **Não** é o gerenciador de pacotes (`flex mod`, Estágio B da Seção 8) — sem dependências remotas, sem manifesto `flex.toml` com `[dependencies]`, sem lockfile. Só resolução de arquivos **locais**, no mesmo repositório.
- **Não** resolve ciclos de import automaticamente — um ciclo é erro de compilação (ver Design Detalhado).

## Design Detalhado

### Sintaxe

```flexlang
// routes/users.flex
import { find_by_id, insert } from "../repository/users";
import { User } from "../models/user";

func get_user(req: Request, mut res: Response) {
    let id = req.param_int("id")?;
    match find_by_id(id) {
        Ok(user) => res.json(user),
        Err(e) => res.error(404, e),
    }
}
```

O parser já aceita essa sintaxe (`import { A, B } from "..."` — `parser.ts:143-162`); a diferença é puramente semântica: se `moduleName` **começa com `.` ou `/`** (caminho relativo/absoluto), é módulo local, resolvido no filesystem; senão, é módulo nativo (resolvido via `ModuleRegistry` da RFC-003) ou — pós-v1.0 — pacote remoto (Seção 8, Estágio B).

### Resolução (pipeline de compilação multi-arquivo)

Hoje o pipeline é linear: `Lexer → Parser → TypeChecker → (Interpreter | Transpiler)`, um arquivo por vez. Passa a ser:

1. **Descoberta de grafo**: a partir do arquivo de entrada (`flex run main.flex`), resolver recursivamente cada `ImportDeclaration` local para um caminho de arquivo (`path.resolve(dirname(arquivo_atual), moduleName + ".flex")`), construindo um grafo de dependências entre arquivos.
2. **Detecção de ciclo**: DFS sobre o grafo; um ciclo é `CompileError: circular import between 'a.flex' and 'b.flex'` — erro de compilação, não resolvido silenciosamente (ao contrário de JS/CommonJS, que tolera ciclos com módulos parcialmente inicializados — não vale a complexidade para a v1.0).
3. **Ordem topológica**: cada arquivo é lexado/parseado/type-checado na ordem de dependência (folhas primeiro), com os símbolos exportados de um arquivo entrando no ambiente de checagem/execução do arquivo que o importa.
4. **Exportação implícita**: por simplicidade na v1.0, **toda** declaração top-level (`struct`, `func`, `enum`, `trait`) de um arquivo é exportável — não existe ainda a noção de `pub`/privado. Só o que está listado no `import { X, Y }` entra de fato no escopo do arquivo importador (o destructuring já filtra).

### Impacto no `TypeChecker`

O `TypeChecker.check()` (`checker.ts:62`) hoje recebe `Stmt[]` de um único arquivo. Passa a receber o grafo resolvido e rodar o Pass 1 (hoisting) por arquivo, **agregando** os `structs`/`functions`/`enums`/`traits` de todos os arquivos do grafo antes do Pass 2 (checagem profunda) começar em qualquer um deles — do contrário, `routes/users.flex` checaria antes de `models/user.flex` existir no escopo, mesmo a dependência sendo direta.

### Impacto no Interpretador e no Transpiler

- **Interpretador**: cada arquivo do grafo roda seu próprio conjunto de `evaluateStmt` de declaração (structs/funcs/enums/traits) contra um `Environment` raiz compartilhado, na ordem topológica — sem mudança de modelo de execução, só de "quantos arquivos alimentam o mesmo ambiente global".
- **Transpiler**: todos os arquivos do grafo emitem para o **mesmo** arquivo `.go` de saída (Go não tem o conceito de import relativo dentro de um só `package main`) — nomes de símbolo precisam ser únicos globalmente; colisão de nome entre dois arquivos (`func process` em `a.flex` e `b.flex`) é erro de compilação nesta fase, resolvido futuramente com namespacing automático se necessário.

## Plano de Testes

1. Projeto de teste com 3 arquivos (`main.flex`, `models/user.flex`, `repository/users.flex`), validando resolução correta e ordem de checagem.
2. Teste negativo: import circular entre dois arquivos deve falhar com mensagem clara antes de qualquer tentativa de execução.
3. Teste negativo: import de um arquivo inexistente falha com `ImportError` (não com um erro genérico de filesystem).
4. Teste de transpilação: o mesmo projeto de 3 arquivos deve gerar um único `.go` válido via `flex build`, cobrindo o parity gate da RFC-001.

## Critério de Aceite

- [ ] `flex run main.flex` resolve e executa um projeto com pelo menos 3 arquivos locais interligados por `import`.
- [ ] Ciclo de import é detectado e reportado antes da execução.
- [ ] `flex build` do mesmo projeto multi-arquivo gera um único `.go` que compila.

## Riscos e Alternativas Consideradas

- **Alternativa descartada**: compilar cada arquivo `.flex` para um arquivo `.go` separado, usando o sistema de packages nativo do Go. Rejeitada para v1.0 por aumentar a superfície de mapeamento (visibilidade `pub`/privado do FlexLang precisaria espelhar exportação de package do Go) sem benefício correspondente — um único arquivo `.go` de saída é suficiente e mais simples de manter correto.
- **Risco**: "exportação implícita" (tudo é público) é uma decisão que pode precisar de revisão pós-v1.0 quando a v1.0 real começar a sentir falta de encapsulamento entre módulos internos de um projeto grande — aceito deliberadamente para não bloquear a v1.0 com uma feature (`pub`/privado) que o caso de uso de referência não exige.
