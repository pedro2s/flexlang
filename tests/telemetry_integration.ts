import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { TypeChecker } from "../src/checker";
import { Interpreter } from "../src/interpreter";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ${green("[PASS]")} ${label}`);
    passed++;
  } else {
    console.log(`  ${red("[FAIL]")} ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function runFlex(code: string): Promise<string> {
  const ast = new Parser(new Lexer(code).tokenize()).parse();
  new TypeChecker().check(ast);

  let output = "";
  const interpreter = new Interpreter((msg) => {
    output += msg + "\n";
  });
  await interpreter.run(ast);
  return output;
}

async function main() {
  console.log("\n== Teste de Integração: Módulo de Telemetria e Métricas Prometheus (RFC-039) ==");

  // Cenário 1: Contadores e Gauges com múltiplos labels
  {
    const code = `
      import { metrics } from "core/telemetry";

      metrics.reset();
      let pix = metrics.counter("financial_transfers_total", "Contador de transferencias financeiras");
      pix.inc({ "type": "pix", "status": "200" });
      pix.add(5.0, { "type": "pix", "status": "200" });
      pix.inc({ "type": "ted", "status": "500" });

      let gauge = metrics.gauge("db_pool_active_connections", "Conexoes ativas no banco");
      gauge.set(25.0, { "database": "primary" });
      gauge.inc({ "database": "primary" });
      gauge.dec({ "database": "primary" });

      let c1 = pix.get({ "type": "pix", "status": "200" });
      let c2 = pix.get({ "type": "ted", "status": "500" });
      let g1 = gauge.get({ "database": "primary" });

      print("pix_200: \${c1}");
      print("ted_500: \${c2}");
      print("db_conns: \${g1}");
    `;

    const out = await runFlex(code);
    check("Contador com múltiplos labels e incrementos", out.includes("pix_200: 6"), out);
    check("Contador com outra combinação de labels", out.includes("ted_500: 1"), out);
    check("Gauge set e operações inc/dec", out.includes("db_conns: 25"), out);
  }

  // Cenário 2: Histograma de Latência e Timer
  {
    const code = `
      import { metrics } from "core/telemetry";

      metrics.reset();
      let hist = metrics.histogram("request_latency_seconds", "Latencia das requisicoes", [0.05, 0.1, 0.25, 0.5, 1.0]);
      hist.observe(0.04, { "endpoint": "/pix" });
      hist.observe(0.08, { "endpoint": "/pix" });
      hist.observe(0.45, { "endpoint": "/pix" });

      let timer = hist.start_timer({ "endpoint": "/pix" });
      timer.observe_duration();

      let h_count = hist.get_count({ "endpoint": "/pix" });
      let h_sum = hist.get_sum({ "endpoint": "/pix" });
      let sum_ok = h_sum > 0.56;

      print("hist_count: \${h_count}");
      print("hist_sum_valid: \${sum_ok}");
    `;

    const out = await runFlex(code);
    check("Histograma com observações e start_timer", out.includes("hist_count: 4"), out);
    check("Histograma acumulando soma de durações", out.includes("hist_sum_valid: true"), out);
  }

  // Cenário 3: Exportação de Texto Prometheus
  {
    const code = `
      import { metrics } from "core/telemetry";

      metrics.reset();
      let c = metrics.counter("http_requests_total", "Total de requisicoes");
      c.inc({ "method": "GET", "handler": "health" });

      let g = metrics.gauge("memory_usage_bytes", "Uso de memoria");
      g.set(1048576.0);

      let text = metrics.export_prometheus();
      let has_help_c = text.contains("# HELP http_requests_total Total de requisicoes");
      let has_type_c = text.contains("# TYPE http_requests_total counter");
      let has_metric_c = text.contains("http_requests_total") && text.contains("handler=") && text.contains("method=") && text.contains("1");
      let has_help_g = text.contains("# HELP memory_usage_bytes Uso de memoria");
      let has_type_g = text.contains("# TYPE memory_usage_bytes gauge");
      let has_metric_g = text.contains("memory_usage_bytes 1048576");

      print("has_help_c: \${has_help_c}");
      print("has_type_c: \${has_type_c}");
      print("has_metric_c: \${has_metric_c}");
      print("has_help_g: \${has_help_g}");
      print("has_type_g: \${has_type_g}");
      print("has_metric_g: \${has_metric_g}");
    `;

    const out = await runFlex(code);
    check("Exportador Prometheus emite HELP e TYPE corretos", out.includes("has_help_c: true") && out.includes("has_type_c: true"), out);
    check("Exportador Prometheus formata série do contador com labels", out.includes("has_metric_c: true"), out);
    check("Exportador Prometheus formata métrica sem labels", out.includes("has_metric_g: true"), out);
  }

  // Cenário 4: Distributed Tracing W3C TraceContext
  {
    const code = `
      import { tracer } from "core/telemetry";

      let headers = {
        "Traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        "Tracestate": "rojo=1,congo=2"
      };

      let span = tracer.start_span_from_headers("http_request", headers);
      span.set_tag("user_id", "usr-42");
      span.set_tag("tenant", "nubank");

      let out_headers = span.inject_w3c_headers();
      let span_id = span.span_id();

      match out_headers.get("traceparent") {
        Option.Some(tp) {
          let has_prefix = tp.starts_with("00-0af7651916cd43dd8448eb211c80319c-");
          let has_suffix = tp.ends_with("-01");
          print("w3c_tp_prefix: \${has_prefix}");
          print("w3c_tp_suffix: \${has_suffix}");
        },
        Option.None {
          print("w3c_tp_prefix: false");
        }
      }

      match out_headers.get("tracestate") {
        Option.Some(ts) {
          let ts_match = ts == "rojo=1,congo=2";
          print("w3c_tracestate: \${ts_match}");
        },
        Option.None {
          print("w3c_tracestate: false");
        }
      }

      let parent_ok = span.parent_span_id() == "b7ad6b7169203331";
      let tag_u = span.get_tag("user_id");
      let tag_t = span.get_tag("tenant");
      print("span_parent_id: \${parent_ok}");
      print("span_tag_user: \${tag_u}");
      print("span_tag_tenant: \${tag_t}");

      let child = tracer.start_span("database_call", span);
      let child_trace_match = child.trace_id() == span.trace_id();
      let child_parent_match = child.parent_span_id() == span.span_id();
      print("child_trace_id_matches: \${child_trace_match}");
      print("child_parent_is_parent_span: \${child_parent_match}");

      span.finish();
      child.finish();
      let s_fin = span.is_finished();
      let c_fin = child.is_finished();
      print("span_finished: \${s_fin}");
      print("child_finished: \${c_fin}");
    `;

    const out = await runFlex(code);
    check("W3C Traceparent gerado com trace_id existente e novo span_id", out.includes("w3c_tp_prefix: true") && out.includes("w3c_tp_suffix: true"), out);
    check("W3C Tracestate preservado na injeção de headers", out.includes("w3c_tracestate: true"), out);
    check("Tags e atributos do Span gravados e lidos corretamente", out.includes("span_tag_user: usr-42") && out.includes("span_tag_tenant: nubank"), out);
    check("Span filho herda trace_id e define parent_span_id como o span pai", out.includes("child_trace_id_matches: true") && out.includes("child_parent_is_parent_span: true"), out);
    check("Spans finalizados corretamente com finish()", out.includes("span_finished: true") && out.includes("child_finished: true"), out);
  }

  // Cenário 5: Tracing com headers ausentes ou inválidos (Geração de novo Trace)
  {
    const code = `
      import { tracer } from "core/telemetry";

      let empty_headers = { "content-type": "application/json" };
      let span_root = tracer.start_span_from_headers("background_job", empty_headers);

      let t_len = span_root.trace_id().len();
      let s_len = span_root.span_id().len();
      let p_empty = span_root.parent_span_id() == "";

      print("root_trace_len: \${t_len}");
      print("root_span_len: \${s_len}");
      print("root_parent_empty: \${p_empty}");
    `;

    const out = await runFlex(code);
    check("Trace raiz gera 32 hex chars (128-bit) para trace_id", out.includes("root_trace_len: 32"), out);
    check("Trace raiz gera 16 hex chars (64-bit) para span_id", out.includes("root_span_len: 16"), out);
    check("Trace raiz não possui parent_span_id", out.includes("root_parent_empty: true"), out);
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro no teste de integração de telemetria:", err);
  process.exit(1);
});
