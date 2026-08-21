// Teste RFC-040: Mensageria de Eventos Financeiros (mq/kafka)

import { Producer, Consumer, EventMessage, KafkaConfig } from "mq/kafka";

func test_producer_and_consumer() -> Result<Int, String> {
    print("--- 1. Producer Setup & Publish ---");
    let producer = Producer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        client_id: "flexbank-producer",
        acks: "all"
    })?;

    producer.publish("banking.transfers.settled", EventMessage {
        key: "acc-1001",
        value: "{\"event_id\":\"evt-01\",\"type\":\"PIX_SETTLED\",\"amount\":\"350.00\"}",
        headers: { "X-Event-Type": "PIX_SETTLED" }
    })?;

    let batch = [
        EventMessage {
            key: "acc-1002",
            value: "{\"event_id\":\"evt-02\",\"type\":\"PIX_SETTLED\",\"amount\":\"120.00\"}",
            headers: { "X-Event-Type": "PIX_SETTLED" }
        },
        EventMessage {
            key: "acc-1003",
            value: "{\"event_id\":\"evt-03\",\"type\":\"PIX_SETTLED\",\"amount\":\"500.00\"}",
            headers: { "X-Event-Type": "PIX_SETTLED" }
        }
    ];

    producer.publish_batch("banking.transfers.settled", batch)?;
    print("Producer published 3 events successfully");

    print("--- 2. Consumer Setup & Listen ---");
    let consumer = Consumer.new(KafkaConfig {
        brokers: ["kafka.internal:9092"],
        group_id: "flexbank-audit-group"
    })?;

    consumer.subscribe(["banking.transfers.settled"])?;

    consumer.listen(|msg| {
        let key_val = msg.key;
        let val_val = msg.value;
        let topic_val = msg.topic;
        print("Consumed event [${topic_val}] key=${key_val} value=${val_val}");
        return Result.Ok(1);
    })?;

    print("--- 3. Consumer Poll After Commit ---");
    let remaining = consumer.poll()?;
    let remaining_len = remaining.len();
    print("Remaining messages after commit: ${remaining_len}");

    producer.close()?;
    consumer.close()?;
    print("Producer and Consumer closed successfully");

    return Result.Ok(0);
}

match test_producer_and_consumer() {
    Result.Ok(code) {
        print("Kafka test finished successfully");
    },
    Result.Err(e) {
        print("Kafka test error: ${e}");
    }
}
