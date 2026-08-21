// Teste RFC-039: Módulo de Telemetria, Métricas Prometheus e Tracing W3C (core/telemetry)

import { metrics, tracer, Span } from "core/telemetry";

func test_counter() {
    print("--- 1. Counter ---");
    let pix_counter = metrics.counter("pix_transfers_total", "Total de transferencias Pix executadas");
    pix_counter.inc({ "channel": "mobile", "status": "success" });
    pix_counter.add(4.0, { "channel": "mobile", "status": "success" });
    pix_counter.inc({ "channel": "web", "status": "failed" });

    let count_success = pix_counter.get({ "channel": "mobile", "status": "success" });
    let count_failed = pix_counter.get({ "channel": "web", "status": "failed" });
    print("Pix success count: ${count_success}");
    print("Pix failed count: ${count_failed}");
}

func test_gauge() {
    print("--- 2. Gauge ---");
    let active_ws_conns = metrics.gauge("active_connections", "Conexoes ativas no momento");
    active_ws_conns.set(142.0);
    let g1 = active_ws_conns.get();
    print("Gauge set: ${g1}");
    active_ws_conns.inc();
    active_ws_conns.add(10.0);
    let g2 = active_ws_conns.get();
    print("Gauge after add: ${g2}");
    active_ws_conns.dec();
    active_ws_conns.sub(2.0);
    let g3 = active_ws_conns.get();
    print("Gauge after sub: ${g3}");
}

func test_histogram() {
    print("--- 3. Histogram ---");
    let latency_hist = metrics.histogram(
        "http_request_duration_seconds",
        "Latencia das requisicoes HTTP",
        [0.01, 0.05, 0.1, 0.5, 1.0]
    );

    latency_hist.observe(0.042, { "method": "POST", "route": "/transfers" });
    latency_hist.observe(0.085, { "method": "POST", "route": "/transfers" });

    let sum = latency_hist.get_sum({ "method": "POST", "route": "/transfers" });
    let count = latency_hist.get_count({ "method": "POST", "route": "/transfers" });
    let is_positive = sum > 0.0;
    print("Histogram count: ${count}");
    print("Histogram sum > 0: ${is_positive}");
}

func test_prometheus_export() {
    print("--- 4. Prometheus Export ---");
    let prom_text = metrics.export_prometheus();
    let contains_counter_help = prom_text.contains("# HELP pix_transfers_total Total de transferencias Pix executadas");
    let contains_counter_type = prom_text.contains("# TYPE pix_transfers_total counter");
    let contains_counter_series = prom_text.contains("pix_transfers_total") && prom_text.contains("mobile") && prom_text.contains("success");
    let contains_gauge_help = prom_text.contains("# HELP active_connections Conexoes ativas no momento");
    let contains_gauge_val = prom_text.contains("active_connections 150");
    let contains_hist_help = prom_text.contains("# HELP http_request_duration_seconds Latencia das requisicoes HTTP");
    let contains_hist_bucket = prom_text.contains("http_request_duration_seconds_bucket") && prom_text.contains("0.05");
    let contains_hist_inf = prom_text.contains("http_request_duration_seconds_bucket") && prom_text.contains("+Inf");

    print("Prometheus export counter HELP: ${contains_counter_help}");
    print("Prometheus export counter TYPE: ${contains_counter_type}");
    print("Prometheus export counter series: ${contains_counter_series}");
    print("Prometheus export gauge HELP: ${contains_gauge_help}");
    print("Prometheus export gauge val: ${contains_gauge_val}");
    print("Prometheus export hist HELP: ${contains_hist_help}");
    print("Prometheus export hist bucket: ${contains_hist_bucket}");
    print("Prometheus export hist inf: ${contains_hist_inf}");
}

func test_tracing() {
    print("--- 5. Distributed Tracing W3C ---");
    let incoming_headers = {
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "tracestate": "congo=t61rcWkgMzE"
    };

    let span = tracer.start_span_from_headers("process_pix_transfer", incoming_headers);
    let trace_matches = span.trace_id() == "4bf92f3577b34da6a3ce929d0e0e4736";
    let parent_matches = span.parent_span_id() == "00f067aa0ba902b7";
    let span_len = span.span_id().len();
    print("Span trace_id matches incoming: ${trace_matches}");
    print("Span parent_span_id matches incoming: ${parent_matches}");
    print("Span span_id length: ${span_len}");

    span.set_tag("account_id", "acc-12345");
    span.set_tag("amount_brl", "1500.00");
    let tag_acc = span.get_tag("account_id");
    let tag_amt = span.get_tag("amount_brl");
    print("Tag account_id: ${tag_acc}");
    print("Tag amount_brl: ${tag_amt}");

    let outgoing_headers = span.inject_w3c_headers();
    let span_id_val = span.span_id();
    let expected_prefix = "00-4bf92f3577b34da6a3ce929d0e0e4736-${span_id_val}-01";

    match outgoing_headers.get("traceparent") {
        Option.Some(tp) {
            let outgoing_matches = tp == expected_prefix;
            print("Outgoing traceparent matches: ${outgoing_matches}");
        },
        Option.None {
            print("Outgoing traceparent matches: false");
        }
    }

    match outgoing_headers.get("tracestate") {
        Option.Some(ts) {
            let tracestate_matches = ts == "congo=t61rcWkgMzE";
            print("Outgoing tracestate preserved: ${tracestate_matches}");
        },
        Option.None {
            print("Outgoing tracestate preserved: false");
        }
    }

    // Child span
    let child_span = tracer.start_span("bacen_transfer_call", span);
    let child_trace_equals = child_span.trace_id() == span.trace_id();
    let child_parent_equals = child_span.parent_span_id() == span.span_id();
    let child_differs = child_span.span_id() != span.span_id();
    print("Child trace_id equals parent trace_id: ${child_trace_equals}");
    print("Child parent_span_id equals parent span_id: ${child_parent_equals}");
    print("Child span_id differs from parent: ${child_differs}");

    span.finish();
    child_span.finish();
    let span_fin = span.is_finished();
    let child_fin = child_span.is_finished();
    print("Span is finished: ${span_fin}");
    print("Child span is finished: ${child_fin}");
}

func main() {
    test_counter();
    test_gauge();
    test_histogram();
    test_prometheus_export();
    test_tracing();
}

main();
