---
title: mq/kafka — Event Messaging
description: Publishing and consuming event streams via Apache Kafka with Consumer Groups, partitioning, and W3C headers.
---

The `mq/kafka` module (also available under `mq/events`) provides event messaging for asynchronous financial settlement and distributed stream processing.

```flexlang
import { Producer, Consumer, KafkaConfig, EventMessage } from "mq/kafka";
```

---

## 📤 1. Publishing Events (`Producer`)

```flexlang
let producer = Producer.new(KafkaConfig {
    brokers: ["kafka.internal:9092"],
    client_id: "core-producer",
    acks: "all"
})?;

let msg = EventMessage {
    key: "acc_alice_101",
    value: "{\"tx_id\":\"tx_pix_9918\",\"amount\":\"250.00\"}",
    headers: { "X-Event-Type": "PIX_SETTLED" }
};
producer.publish("pix.settled", msg)?;
```

---

## 📥 2. Consuming Events (`Consumer`)

```flexlang
let consumer = Consumer.new(KafkaConfig {
    brokers: ["kafka.internal:9092"],
    group_id: "audit-settlement-group",
    auto_offset_reset: "latest"
})?;

consumer.listen(|msg: EventMessage| {
    print("Received event: ${msg.value}");
});
```
