# RFC-039 — Módulo de Telemetria, Métricas Prometheus e Tracing W3C (`core/telemetry`)

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** RFC-008 (`core/log`), RFC-027 (`core/time`)

---

## 1. Motivação

Em operações bancárias de grande porte, visibilidade em tempo real é exigência regulatória e operacional. É mandatório:
1. **Coletar Métricas de Negócio e Infraestrutura**: Quantidade de transferências Pix por segundo, valor total liquidado, contagem de erros 5xx, latência percentil (p95, p99) exportada no padrão Prometheus (`/metrics`).
2. **Tracing Distribuído Ponta a Ponta (W3C TraceContext)**: Rastrear uma transação desde a requisição no app mobile, passando pelo gateway, core banking e fila de liquidação através de `traceparent` e `tracestate`.

---

## 2. Design da API

### 2.1 Métricas Prometheus (Contadores, Gauges, Histogramas)

```flexlang
import { metrics } from "core/telemetry";

// 1. Contador (Counter)
let pix_counter = metrics.counter("pix_transfers_total", "Total de transferencias Pix executadas");
pix_counter.inc({ "status": "success", "channel": "mobile" });

// 2. Medidor (Gauge - valores que sobem e descem)
let active_ws_conns = metrics.gauge("active_connections", "Conexoes ativas no momento");
active_ws_conns.set(142.0);

// 3. Histograma de Latência (com buckets padrão para SLA financeiro)
let latency_hist = metrics.histogram(
    "http_request_duration_seconds",
    "Latencia das requisicoes HTTP",
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
);

let timer = latency_hist.start_timer({ "route": "/transfers", "method": "POST" });
// ... executa logica ...
timer.observe_duration(); // Grava a latência automaticamente
```

---

### 2.2 Endpoint de Métricas do Servidor HTTP

```flexlang
// Expõe métricas no formato padrão Prometheus (scraping)
server.get("/metrics", |req, mut res| {
    res.header("Content-Type", "text/plain; version=0.0.4");
    res.send_string(metrics.export_prometheus());
});
```

---

### 2.3 Tracing Distribuído W3C TraceContext

```flexlang
import { tracer, Span } from "core/telemetry";

// Cria um Span raiz ou propaga span recebido via cabeçalho W3C
let span = tracer.start_span_from_headers("process_pix_transfer", req.headers());

span.set_tag("account_id", "acc-12345");
span.set_tag("amount_brl", "1500.00");

// Injeta cabeçalhos para chamada no Cliente HTTP subsequente
let outgoing_headers = span.inject_w3c_headers();
let bacen_res = client.get_with("https://bacen.gov.br", RequestOptions {
    headers: outgoing_headers
});

span.finish();
```

---

## 3. Implementação e Paridade

- Formato de exportação Prometheus em texto plano compatível com Grafana/Prometheus Server.
- Geração de 64-bit Span IDs e 128-bit Trace IDs em conformidade com o padrão OpenTelemetry e W3C TraceContext.
- Parity gate 100% verificado.
