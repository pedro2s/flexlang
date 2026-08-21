---
title: core/telemetry — Métricas Prometheus & Tracing W3C
description: Observabilidade nativa, exportação de métricas Prometheus textuais e Distributed Tracing compatível com OpenTelemetry W3C.
---

O módulo `core/telemetry` fornece observabilidade de primeira classe com métricas em formato padrão Prometheus e distributed tracing compatível com OpenTelemetry / W3C TraceContext.

```flexlang
import { metrics, Counter, Gauge, Histogram, tracer, Span } from "core/telemetry";
import { Server, Request, Response } from "net/http";
```

---

## 📈 1. Métricas Prometheus

### Contadores, Gauges e Histogramas

```flexlang
// 1. Contador com labels
let http_requests = metrics.counter("http_requests_total", "Total de requisições recebidas");
http_requests.inc();
http_requests.add(5.0);

// 2. Gauge (valores que sobem e descem)
let active_connections = metrics.gauge("active_db_connections", "Conexões ativas no pool");
active_connections.set(12.0);
active_connections.inc();
active_connections.dec();

// 3. Histograma de latência
let latency_hist = metrics.histogram("http_request_duration_seconds", "Latência das requisições em segundos");
latency_hist.observe(0.045); // 45ms
```

### Endpoint `/metrics`

```flexlang
let mut server = Server.new(":8080");

server.get("/metrics", |req: Request, mut res: Response| {
    // Exporta todas as séries no formato canônico do Prometheus
    res.send_string(metrics.export_prometheus());
});
```

---

## 🔍 2. Distributed Tracing (W3C TraceContext)

```flexlang
// Criação de Span raiz (gera 128-bit trace ID e 64-bit span ID)
let span = tracer.start_span("process_pix_transfer");
span.set_tag("account.id", "acc_10928");
span.set_tag("amount", "250.00");

// Injeção de headers para chamadas de downstream
let w3c_headers = span.inject_w3c_headers();
// w3c_headers contém: { "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" }

span.finish();
```
