// Serviço de Notificações e Auditoria Assíncrona

import { log } from "core/log";

func notify_appointment_created(client_name: String, service_title: String, price: Float) {
    log.info("Notificacao enviada ao cliente", {
        client: client_name,
        service: service_title,
        price: price,
        channel: "whatsapp"
    });
}

func log_audit_event(action: String, operator: String, resource_id: Int) {
    log.info("Auditoria registrada", {
        action: action,
        operator: operator,
        resource_id: resource_id
    });
}
