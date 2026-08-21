---
title: mq/kafka — Mensageria de Eventos Financeiros
description: Publicação e consumo de streams de eventos via Apache Kafka com Consumer Groups, particionamento e headers W3C.
---

O módulo `mq/kafka` (também acessível pelo alias `mq/events`) fornece mensageria de alta performance para arquiteturas orientadas a eventos e liquidação assíncrona.

```flexlang
import { Producer, Consumer, KafkaConfig, EventMessage } from "mq/kafka";
```

---

## 📤 1. Publicação de Eventos (`Producer`)

```flexlang
let producer = Producer.new(KafkaConfig {
    brokers: ["kafka.internal:9092"],
    client_id: "core-producer",
    acks: "all"
})?;

// Publicação de mensagem única com particionamento por chave
let msg = EventMessage {
    key: "acc_alice_101",
    value: "{\"tx_id\":\"tx_pix_9918\",\"amount\":\"250.00\"}",
    headers: { "X-Event-Type": "PIX_SETTLED" }
};
producer.publish("pix.settled", msg)?;

// Publicação em lote (batch)
let batch = [msg1, msg2, msg3];
producer.publish_batch("pix.settled", batch)?;
```

---

## 📥 2. Consumo de Eventos (`Consumer`)

Consumo por Consumer Groups com rebalanceamento e offset automático:

```flexlang
let consumer = Consumer.new(KafkaConfig {
    brokers: ["kafka.internal:9092"],
    group_id: "audit-settlement-group",
    auto_offset_reset: "latest"
})?;

// Listener contínuo em background
consumer.listen(|msg: EventMessage| {
    print("Evento recebido no tópico pix.settled: ${msg.value}");
});

// Leitura em lote com poll sob demanda
let messages = consumer.poll(10); // Busca até 10 mensagens
for (m in messages) {
    process_message(m);
}
consumer.commit();
```
