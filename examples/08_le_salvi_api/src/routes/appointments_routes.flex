// Gestão de Agendamentos e Procedimentos do Salão Le Salvi

import { Request, Response } from "net/http";
import { Appointment, CreateAppointmentRequest, UpdateStatusRequest } from "../models/entities";
import { LoyaltyBilling } from "../traits/billing";
import { notify_appointment_created, log_audit_event } from "../services/notifications";

func parse_appointment_input(req: Request) -> Result<CreateAppointmentRequest, String> {
    let body: CreateAppointmentRequest = req.json()?;
    return Result.Ok(body);
}

func parse_status_input(req: Request) -> Result<UpdateStatusRequest, String> {
    let body: UpdateStatusRequest = req.json()?;
    return Result.Ok(body);
}

func handle_list_appointments(req: Request, mut res: Response) {
    let appointments = [
        Appointment {
            id: 101,
            client_name: "Mariana Silva",
            professional_name: "Helena Salvi",
            service_title: "Coloracao e Mechas Balayage",
            price: 450.0,
            status: "Scheduled"
        },
        Appointment {
            id: 102,
            client_name: "Beatriz Oliveira",
            professional_name: "Camila Rocha",
            service_title: "Corte e Visagismo Feminino",
            price: 180.0,
            status: "InProgress"
        }
    ];

    match req.query("status") {
        Option.Some(status_filter) {
            res.status(200).json({
                filter_applied: status_filter,
                results: appointments
            });
        },
        Option.None {
            res.status(200).json(appointments);
        }
    }
}

func handle_get_appointment(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            if id == 101 {
                res.status(200).json(Appointment {
                    id: 101,
                    client_name: "Mariana Silva",
                    professional_name: "Helena Salvi",
                    service_title: "Coloracao e Mechas Balayage",
                    price: 450.0,
                    status: "Scheduled"
                });
            } else {
                if id == 102 {
                    res.status(200).json(Appointment {
                        id: 102,
                        client_name: "Beatriz Oliveira",
                        professional_name: "Camila Rocha",
                        service_title: "Corte e Visagismo Feminino",
                        price: 180.0,
                        status: "InProgress"
                    });
                } else {
                    res.error(404, "Agendamento nao encontrado");
                }
            }
        },
        Result.Err(msg) {
            res.error(400, "Identificador de agendamento invalido");
        }
    }
}

func handle_create_appointment(req: Request, mut res: Response) {
    match parse_appointment_input(req) {
        Result.Ok(input) {
            // Aplica regra de faturamento e desconto fidelidade (10% desconto + 5.0 taxa higienizacao)
            let billing = LoyaltyBilling { discount_rate: 0.10, service_tax: 5.0 };
            let final_price = billing.calculate_total(input.price);

            let new_appointment = Appointment {
                id: 103,
                client_name: input.client_name,
                professional_name: input.professional_name,
                service_title: input.service_title,
                price: final_price,
                status: "Scheduled"
            };

            // Notifica cliente e registra auditoria
            notify_appointment_created(input.client_name, input.service_title, final_price);
            log_audit_event("appointment_created", "system_api", 103);

            res.status(201).json(new_appointment);
        },
        Result.Err(err) {
            res.error(400, "Corpo de agendamento malformatado");
        }
    }
}

func handle_update_appointment(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            match parse_appointment_input(req) {
                Result.Ok(input) {
                    let updated = Appointment {
                        id: id,
                        client_name: input.client_name,
                        professional_name: input.professional_name,
                        service_title: input.service_title,
                        price: input.price,
                        status: "Scheduled"
                    };
                    log_audit_event("appointment_fully_updated", "admin_user", id);
                    res.status(200).json(updated);
                },
                Result.Err(err) {
                    res.error(400, "Dados de atualizacao invalidos");
                }
            }
        },
        Result.Err(msg) {
            res.error(400, "ID invalido");
        }
    }
}

func handle_patch_status(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            match parse_status_input(req) {
                Result.Ok(input) {
                    log_audit_event("appointment_status_patched", "professional_user", id);
                    res.status(200).json({
                        id: id,
                        updated_status: input.status,
                        message: "Status atualizado com sucesso"
                    });
                },
                Result.Err(err) {
                    res.error(400, "Status invalido");
                }
            }
        },
        Result.Err(msg) {
            res.error(400, "ID invalido");
        }
    }
}

func handle_cancel_appointment(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            log_audit_event("appointment_cancelled", "client_portal", id);
            res.status(200).json({
                cancelled_id: id,
                status: "Cancelled",
                refund_issued: true
            });
        },
        Result.Err(msg) {
            res.error(400, "ID invalido");
        }
    }
}
