# RFC-007: CLI Toolchain v1

> **Status:** Implementado · **Prioridade:** P0 (exceto `flex fmt`, que é P1) · **Depende de:** RFC-001, RFC-002, RFC-006

## Resumo

A CLI hoje (`src/cli.ts`) tem exatamente dois comandos: `flex run` e `flex build`. Testes rodam via `npm test` chamando `tests/runner.ts` diretamente — não pela CLI. Esta RFC completa a experiência de linha de comando até o ponto que um time novo consegue começar um projeto, testá-lo e compilá-lo sem sair do binário `flex`.

## Motivação

Uma linguagem "moderna" (termo do próprio PRD) é julgada pela primeira experiência: `flex init`, escrever código, `flex test`, `flex build`, deploy. Faltando qualquer um desses elos, a experiência de adoção quebra antes mesmo do código chegar em produção.

## Não-objetivos

- `flex mod` (gerenciador de pacotes remoto) — fora de escopo da v1.0 (PRD, Seção 4).
- `flex fmt` com regras de formatação totalmente polidas — entra como P1, um formatador funcional básico (indentação e espaçamento consistentes) é aceitável; regras de estilo refinadas podem evoluir pós-v1.0 sem quebrar compatibilidade (formatadores não têm "versão de linguagem", só convergem com o tempo).

## Design Detalhado

### `flex init <nome>`

Cria a estrutura mínima de projeto:

```
minha-api/
  flex.toml
  main.flex
  routes/
  models/
  repository/
```

`flex.toml` nesta fase é **só metadado de projeto**, sem seção `[dependencies]` (essa chega com o gerenciador de pacotes, pós-v1.0):

```toml
[package]
name = "minha-api"
version = "0.1.0"
entry = "main.flex"
```

### `flex test`

Substitui a chamada direta a `tests/runner.ts` por um comando de primeira classe: `flex test` roda a suíte golden-file do **projeto do usuário** (não só a suíte interna da linguagem) — convenção: todo arquivo `*_test.flex` ao lado do código testado é executado, comparando saída contra um `.out` correspondente (mesmo modelo já usado internamente em `tests/runner.ts`, generalizado para qualquer projeto FlexLang).

```bash
flex test              # roda todos os *_test.flex do projeto
flex test routes/      # só os testes dentro de um diretório
```

### `flex build` — hardening

Já existe (`cli.ts:49-67`), mas precisa de dois reforços para v1.0:

1. **Erros de `go build` propagados com contexto útil** — hoje um erro do `go build` só imprime "Do you have Go installed?" (`cli.ts:65`), mesmo quando o problema é outro (ex: Go instalado, mas o código gerado não compila — o próprio bug que a RFC-001 fecha). Passa a inspecionar a saída do `go build` e diferenciar "Go não encontrado" de "erro de compilação no Go gerado" (este último indicaria uma regressão de paridade, e deveria falhar o build de forma ruidosa, nunca silenciosa).
2. **Código de saída (`exit code`) correto** — `flex build`/`flex test` devem retornar `exit 1` em qualquer falha, para integração com CI (hoje só `flex test` via `npm test` faz isso, `cli.ts` de `flex build` não trata exit code de forma consistente).

### `flex fmt` (P1)

Formatador determinístico: mesma entrada sempre produz a mesma saída formatada; sem opções configuráveis na v1.0 (uma opinião só, "estilo FlexLang", sem `.flexfmt.toml` — decisão deliberada para não repetir o bikeshedding de formatação que outras linguagens tiveram antes de terem opinião própria).

## Plano de Testes

1. `flex init` gera uma estrutura que compila e roda sem edição manual (`flex build` do projeto recém-criado deve funcionar de primeira).
2. `flex test` em um projeto com testes passando e falhando, validando exit code e output.
3. `flex build` com um erro proposital no Go gerado (simulando uma regressão de RFC-001) deve reportar isso de forma clara, não como "Go não instalado".

## Critério de Aceite

- [ ] `flex init`, `flex test` implementados e documentados.
- [ ] `flex build` diferencia "Go ausente" de "erro de compilação Go" na mensagem de erro.
- [ ] Todos os comandos retornam exit code correto para uso em CI.
- [ ] `flex fmt` (se entrar na v1.0) é determinístico e sem configuração.

## Riscos e Alternativas Consideradas

- **Risco de escopo**: a tentação de adicionar flags/configuração a cada comando desde já. Mitigação: cada comando desta RFC nasce sem flags além do estritamente necessário (`flex test <path>` é a única exceção, e é natural o suficiente para não contar como scope creep).
