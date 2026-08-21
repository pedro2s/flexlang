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
  console.log("\n== Teste de Integração: Módulo de Mensageria Kafka e Eventos (RFC-040) ==");

  // Cenário 1: Erros de Configuração Estáticos e Dinâmicos
  {
    const code = `
      import { Producer, Consumer, KafkaConfig } from "mq/kafka";

      let p_err = Producer.new(KafkaConfig {
        brokers: []
      });
      match p_err {
        Result.Ok(p) { print("p_err: SHOULD_FAIL"); },
        Result.Err(e) { print("p_err_ok: \${e}"); }
      }

      let c_err = Consumer.new(KafkaConfig {
        brokers: ["localhost:9092"],
        group_id: ""
      });
      match c_err {
        Result.Ok(c) { print("c_err: SHOULD_FAIL"); },
        Result.Err(e) { print("c_err_ok: \${e}"); }
      }
    `;

    const out = await runFlex(code);
    check("Producer rejeita lista de brokers vazia", out.includes("p_err_ok: kafka brokers list cannot be empty"), out);
    check("Consumer exige group_id não vazio", out.includes("c_err_ok: consumer group_id is required"), out);
  }

  // Cenário 2: Publicação e Consumo com mq/events (Alias)
  {
    const code = `
      import { Producer, Consumer, EventMessage, KafkaConfig } from "mq/events";

      let p = Producer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"]
      })?;

      p.publish("events.orders", EventMessage {
        key: "order-99",
        value: "status=CREATED",
        headers: { "X-Source": "Checkout" }
      })?;

      let c = Consumer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        group_id: "order-processor-group"
      })?;

      c.subscribe(["events.orders"])?;

      c.listen(|msg| {
        let k = msg.key;
        let v = msg.value;
        let t = msg.topic;
        print("order_processed: topic=\${t} key=\${k} value=\${v}");
        return Result.Ok(1);
      })?;

      p.close()?;
      c.close()?;
    `;

    const out = await runFlex(code);
    check("Alias mq/events funciona perfeitamente", out.includes("order_processed: topic=events.orders key=order-99"), out);
  }

  // Cenário 3: Múltiplos Consumer Groups Independentes
  {
    const code = `
      import { Producer, Consumer, EventMessage, KafkaConfig } from "mq/kafka";

      let p = Producer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"]
      })?;

      p.publish("banking.pix.out", EventMessage {
        key: "tx-1",
        value: "100.00"
      })?;

      let c1 = Consumer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        group_id: "group-audit"
      })?;
      c1.subscribe(["banking.pix.out"])?;

      let c2 = Consumer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        group_id: "group-antifraud"
      })?;
      c2.subscribe(["banking.pix.out"])?;

      c1.listen(|msg| {
        let k = msg.key;
        print("c1_consumed: \${k}");
        return Result.Ok(1);
      })?;

      c2.listen(|msg| {
        let k = msg.key;
        print("c2_consumed: \${k}");
        return Result.Ok(1);
      })?;

      p.close()?;
      c1.close()?;
      c2.close()?;
    `;

    const out = await runFlex(code);
    check("Consumer Group 1 processa mensagem", out.includes("c1_consumed: tx-1"), out);
    check("Consumer Group 2 independente processa mesma mensagem", out.includes("c2_consumed: tx-1"), out);
  }

  // Cenário 4: Poll sob demanda com lote
  {
    const code = `
      import { Producer, Consumer, EventMessage, KafkaConfig } from "mq/kafka";

      let p = Producer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"]
      })?;

      let batch = [
        EventMessage { key: "batch-1", value: "val-1" },
        EventMessage { key: "batch-2", value: "val-2" }
      ];
      p.publish_batch("banking.batch.jobs", batch)?;

      let c = Consumer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        group_id: "batch-worker"
      })?;
      c.subscribe(["banking.batch.jobs"])?;

      let polled = c.poll(500)?;
      let polled_len = polled.len();
      print("polled_count: \${polled_len}");

      let polled_again = c.poll(100)?;
      let again_len = polled_again.len();
      print("polled_again_count: \${again_len}");

      p.close()?;
      c.close()?;
    `;

    const out = await runFlex(code);
    check("Consumer.poll recupera mensagens em lote", out.includes("polled_count: 2"), out);
    check("Consumer.poll não repete mensagens já consumidas", out.includes("polled_again_count: 0"), out);
  }

  // Cenário 5: Propagação de W3C TraceContext via Headers do Kafka
  {
    const code = `
      import { Producer, Consumer, EventMessage, KafkaConfig } from "mq/kafka";
      import { tracer } from "core/telemetry";

      let span = tracer.start_span("initiate_pix_transfer");
      span.set_tag("pix_id", "pix-999");
      let w3c_headers = span.inject_w3c_headers();

      let p = Producer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"]
      })?;

      p.publish("banking.pix.in", EventMessage {
        key: "pix-999",
        value: "amount=250.00",
        headers: w3c_headers
      })?;

      let c = Consumer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        group_id: "settlement-consumer"
      })?;
      c.subscribe(["banking.pix.in"])?;

      c.listen(|msg| {
        let incoming_span = tracer.start_span_from_headers("settle_pix", msg.headers);
        let same_trace = incoming_span.trace_id() == span.trace_id();
        let parent_is_producer = incoming_span.parent_span_id() == span.span_id();
        print("trace_propagated: \${same_trace}");
        print("parent_propagated: \${parent_is_producer}");
        incoming_span.finish();
        return Result.Ok(1);
      })?;

      span.finish();
      p.close()?;
      c.close()?;
    `;

    const out = await runFlex(code);
    check("W3C Trace ID propagado de ponta a ponta através do Kafka", out.includes("trace_propagated: true"), out);
    check("W3C Parent Span ID vinculado ao span do produtor", out.includes("parent_propagated: true"), out);
  }

  console.log(`\nResultados: ${passed} passaram, ${failed} falharam.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erro no teste de integração Kafka:", err);
  process.exit(1);
});
