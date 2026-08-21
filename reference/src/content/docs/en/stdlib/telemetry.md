---
title: core/telemetry — Metrics & OpenTelemetry
description: Native observability, Prometheus metrics export, and W3C TraceContext distributed tracing.
---

The `core/telemetry` module provides observability with standard Prometheus metrics formatting and OpenTelemetry W3C distributed tracing.

```flexlang
import { metrics, Counter, Gauge, Histogram, tracer, Span } from "core/telemetry";
```

---

## 📈 1. Prometheus Metrics

```flexlang
let http_requests = metrics.counter("http_requests_total", "Total incoming requests");
http_requests.inc();

let active_connections = metrics.gauge("active_db_connections", "Active pool connections");
active_connections.set(12.0);

let latency = metrics.histogram("http_request_duration_seconds", "Request latency in seconds");
latency.observe(0.045);

// Textual Prometheus export:
let prometheus_text = metrics.export_prometheus();
```

---

## 🔍 2. Distributed Tracing

```flexlang
let span = tracer.start_span("pix_transfer");
span.set_tag("account.id", "acc_10928");

let headers = span.inject_w3c_headers();
span.finish();
```
