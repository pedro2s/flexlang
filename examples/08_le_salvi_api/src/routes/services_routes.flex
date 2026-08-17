// Catálogo de Serviços e Procedimentos do Salão

import { Request, Response } from "net/http";
import { SalonService } from "../models/entities";

func handle_list_services(req: Request, mut res: Response) {
    let services = [
        SalonService { id: 1, title: "Corte e Visagismo Feminino", duration_min: 60, price: 180.0 },
        SalonService { id: 2, title: "Coloracao e Mechas Balayage", duration_min: 180, price: 450.0 },
        SalonService { id: 3, title: "Tratamento Capilar Spa & Ozonio", duration_min: 90, price: 280.0 },
        SalonService { id: 4, title: "Design de Sobrancelhas e Micropigmentacao", duration_min: 45, price: 120.0 }
    ];

    res.status(200).json(services);
}

func handle_get_service(req: Request, mut res: Response) {
    match req.param_int("id") {
        Result.Ok(id) {
            if id == 1 {
                res.status(200).json(SalonService { id: 1, title: "Corte e Visagismo Feminino", duration_min: 60, price: 180.0 });
            } else {
                if id == 2 {
                    res.status(200).json(SalonService { id: 2, title: "Coloracao e Mechas Balayage", duration_min: 180, price: 450.0 });
                } else {
                    if id == 3 {
                        res.status(200).json(SalonService { id: 3, title: "Tratamento Capilar Spa & Ozonio", duration_min: 90, price: 280.0 });
                    } else {
                        if id == 4 {
                            res.status(200).json(SalonService { id: 4, title: "Design de Sobrancelhas e Micropigmentacao", duration_min: 45, price: 120.0 });
                        } else {
                            res.error(404, "Servico nao encontrado no catalogo do Le Salvi");
                        }
                    }
                }
            }
        },
        Result.Err(msg) {
            res.error(400, "Identificador de servico invalido");
        }
    }
}
