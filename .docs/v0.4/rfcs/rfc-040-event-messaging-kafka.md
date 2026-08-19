# RFC-040 — Mensageria de Eventos Financeiros (`mq/events`, `mq/kafka`)

> **Status:** Proposto · **Prioridade:** P1 · **Depende de:** RFC-033 (`encoding/json`), RFC-028 (`crypto`)

---

## 1. Motivação

Sistemas bancários modernos utilizam **Arquitetura Orientada a Eventos (EDA - Event-Driven Architecture)** para:
- Conciliação e liquidação assíncrona de transferências em lote.
- Envio de notificações push e SMS de comprovantes Pix sem bloquear a resposta HTTP do usuário.
- Alimentação de data lakes e motores de antifraude assíncronos.

---

## 2. Design da API

```flexlang
import { Producer, Consumer, EventMessage, KafkaConfig } from "mq/kafka";
import { json } from "encoding/json";
import { uuid } from "crypto";

// 1. Inicializa Produtor de Eventos
let producer = Producer.new(KafkaConfig {
    brokers: ["kafka.internal:9092"],
    client_id: "flexbank-core-producer",
    acks: "all"                            // Garantia estrita de persistência em disco
})?;

// 2. Publicação de Evento de Pagamento Liquidado
let event_id = uuid.v4();
let payload = json.stringify({
    "event_id": event_id,
    "type": "PIX_TRANSFER_COMPLETED",
    "source_account": "acc-1001",
    "target_account": "acc-2002",
    "amount": "350.00"
});

producer.publish("banking.transfers.settled", EventMessage {
    key: "acc-1001",                      // Chave para ordenação por partição
    value: payload,
    headers: { "X-Event-Type": "PIX_TRANSFER_COMPLETED" }
})?;
```

---

### 2.3 Consumo Desacoplado com Worker Pool

```flexlang
let consumer = Consumer.new(KafkaConfig {
    brokers: ["kafka.internal:9092"],
    group_id: "flexbank-audit-notifier-group"
})?;

consumer.subscribe(["banking.transfers.settled"])?;

// Processa mensagens com confirmação de entrega (ack)
consumer.listen(|msg| {
    print("Processando evento: ${msg.key}");
    // Executa persistência ou envio de notificação...
    return Result.Ok(Void); // Confirma commit do offset
});
```

---

## 3. Implementação e Paridade

- TypeScript utiliza `kafkajs` com suporte a reconexão automática e heartbeat.
- Go utiliza `github.com/segmentio/kafka-go` ou `confluent-kafka-go` para throughput massivo.
