# RFC-008: Observabilidade e Prontidão Operacional

> **Status:** IMPLEMENTADO · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-004 (hooks entram na superfície do `Server`)

## Resumo

Nenhum dos requisitos desta RFC existe hoje na FlexLang — não porque foram esquecidos, mas porque o interpretador nunca precisou rodar por mais que a duração de um teste. Subir uma API em produção exige o oposto: rodar por dias, sobreviver a um handler que lança um erro inesperado, desligar de forma limpa quando o orquestrador (Kubernetes, systemd) manda parar, e deixar rastro suficiente em log para debugar um incidente. Esta é, junto com a RFC-009, a RFC que transforma "compila e roda" em "pronto para produção".

## Motivação

O requisito não-funcional mais citado por qualquer time avaliando uma linguagem nova para produção é: **uma falha em uma requisição não pode derrubar o processo inteiro**. Hoje, uma exceção não capturada dentro de um handler HTTP (`interpreter.ts:109-117`, bloco `try/catch` do `FlexServer`) já loga o erro no `console.error` e não derruba o processo Node — esse comportamento por acidente é o correto, mas precisa virar garantia deliberada, testada e replicada no binário Go (onde um `panic` dentro de uma goroutine de request, sem `recover()`, **derruba o processo inteiro** — esse é um comportamento real do Go que a v1.0 precisa neutralizar explicitamente).

## Não-objetivos

- Não inclui integração com um backend de observabilidade específico (Datadog, Prometheus, OpenTelemetry) — a v1.0 entrega **logging estruturado para stdout** (o padrão universal de container/orquestrador) e um endpoint de health check; exportação para um APM específico é trabalho de integração, não de linguagem, e fica para depois.
- Não inclui métricas (contadores, histogramas) — só logs e health check na v1.0.

## Design Detalhado

### 1. Recuperação de panic por request (Go)

Todo handler HTTP compilado para Go é envolvido em um `defer/recover` gerado pelo transpiler (RFC-001/RFC-004), equivalente a:

```go
func safeHandler(h func(Request, Response)) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                log.Printf(`{"level":"error","msg":"panic recovered","panic":"%v"}`, rec)
                w.WriteHeader(500)
            }
        }()
        h(Request{Raw: r}, Response{Raw: w})
    }
}
```

Isso é gerado automaticamente para **toda** rota registrada via `server.route(...)` — o desenvolvedor FlexLang não escreve `recover()` manualmente, exatamente como já não escreve `try/catch` manualmente no modo interpretado hoje.

### 2. Logging estruturado

```flexlang
import { log } from "core/log";

log.info("user created", { user_id: user.id });
log.error("db query failed", { error: e });
```

Formato de saída fixo: uma linha JSON por evento (`{"level": "...", "msg": "...", "ts": "...", ...campos}`) — o formato que qualquer coletor de log de container (Docker, Kubernetes) já sabe consumir sem parser customizado. Sem "providers" configuráveis na v1.0 — stdout é o único destino.

### 3. Graceful shutdown

```flexlang
let server = Server.new(":8080");
server.route("/users", get_users);
server.on_shutdown(|| {
    db.close();
    log.info("shutdown complete", {});
});
server.start(); // escuta SIGTERM/SIGINT internamente
```

`server.start()` registra internamente um handler de `SIGTERM`/`SIGINT` (padrão de todo orquestrador de produção para pedir desligamento limpo) que: para de aceitar novas conexões, aguarda requisições em voo terminarem (com um timeout máximo, para não travar um shutdown indefinidamente), executa os callbacks de `on_shutdown`, e só então encerra o processo. Isso mapeia diretamente para `http.Server.Shutdown(ctx)` do Go, que já implementa esse comportamento nativamente.

### 4. Health check

`Server.new` registra automaticamente (sem o desenvolvedor precisar declarar) uma rota `GET /healthz` devolvendo `200 OK` enquanto o processo está saudável e aceitando conexões — o contrato mínimo que todo orquestrador de produção espera para decidir se um pod/instância deve receber tráfego.

## Plano de Testes

1. Handler que lança um erro não tratado: confirmar que o processo continua de pé e outras requisições continuam sendo servidas (modo interpretado e compilado).
2. Enviar `SIGTERM` ao processo em teste, com uma requisição em voo: confirmar que a requisição em voo termina, novas conexões são recusadas, e `on_shutdown` roda antes do processo encerrar.
3. `GET /healthz` retorna 200 sem rota declarada pelo usuário.
4. Validar que `log.error`/`log.info` produzem uma linha JSON válida e parseável.

## Critério de Aceite

- [ ] Um panic em um handler nunca derruba o processo, em modo interpretado nem compilado.
- [ ] `SIGTERM` aciona shutdown gracioso com timeout, testado com requisição em voo.
- [ ] `/healthz` existe por padrão em todo `Server`.
- [ ] Logs saem em JSON estruturado por linha, sem configuração adicional.

## Riscos e Alternativas Consideradas

- **Risco real e específico do Go**: se o `defer/recover` do item 1 não for gerado em **toda** goroutine de request (incluindo as disparadas por `spawn` dentro de um handler), um panic ali ainda derruba o processo. Mitigação: o teste do item 1 desta RFC deve cobrir explicitamente um panic dentro de um `spawn` aninhado num handler, não só no corpo direto do handler.
- **Alternativa descartada**: deixar observabilidade como responsabilidade 100% do usuário (nenhum default). Rejeitada — o PRD define "pronto para produção" como incluindo isso por padrão, não como uma escolha opcional que times esquecem de fazer.
