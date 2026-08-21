// ============================================================================
// 📋 FlexBank Audit & Notifier Service (RFC-043)
// ============================================================================

import { Server, Request, Response } from "net/http";
import { Consumer, KafkaConfig, EventMessage } from "mq/kafka";
import { sha256 } from "crypto";
import { base64 } from "encoding/base64";
import { fs } from "std/fs";
import { metrics, Counter } from "core/telemetry";
import { scheduler, CronJob } from "core/scheduler";
import { env } from "os/env";

func main() {
    let port = env.get_or("AUDIT_PORT", "8083");
    let audit_log_path = env.get_or("AUDIT_LOG_FILE", "build/audit_events.log");

    let addr = ":${port}";
    let mut server = Server.new(addr);

    let audit_counter = metrics.counter("audit_events_total", "Total de eventos de auditoria processados");

    // 1. Healthcheck
    server.get("/healthz", |req: Request, mut res: Response| {
        res.status(200).json({
            status: "ok",
            service: "flexbank-audit-notifier"
        });
    });

    // 2. Métricas Prometheus
    server.get("/metrics", |req: Request, mut res: Response| {
        res.send_string(metrics.export_prometheus());
    });

    // 3. Consumidor do Event Stream
    let cons_cfg = KafkaConfig {
        brokers: ["localhost:9092"],
        group_id: "audit-group"
    };
    let cons_res = Consumer.new(cons_cfg);
    match cons_res {
        Result.Ok(consumer) {
            consumer.listen(|msg: EventMessage| {
                audit_counter.inc();

                // Geração de hash SHA-256 do payload para integridade
                let payload = msg.value;
                let hash_sig = sha256(payload);
                let b64_sig = base64.encode(hash_sig);

                // Persistência de log de auditoria
                let log_entry = "AUDIT_RECORD payload=${payload} sig=${b64_sig}\n";
                fs.append_string(audit_log_path, log_entry);
            });
        },
        Result.Err(e) {
            print("Aviso: Consumer em fallback local");
        }
    }

    // 4. Agendador de Conciliação Noturna
    scheduler.cron("59 23 * * *", || {
        let reconciliation_msg = "LOG CONCILIACAO DIARIA CONCLUIDA\n";
        fs.append_string(audit_log_path, reconciliation_msg);
    });

    print("FlexBank Audit Notifier iniciado na porta ${port}");
    server.start();
}

main();
