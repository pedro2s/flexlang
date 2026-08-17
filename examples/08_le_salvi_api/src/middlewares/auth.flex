// Middlewares de Requisição, Auditoria e Segurança

import { Request, Response } from "net/http";
import { log } from "core/log";

// Middleware 1: Injeta metadados de observabilidade em todas as respostas
func logging_middleware(req: Request, mut res: Response) {
    res.header("X-Powered-By", "FlexLang-Backend-v0.2");
    res.header("X-API-Domain", "le-salvi-estetica");
}

// Middleware 2: Valida cabeçalho de autorização quando exigido
func auth_middleware(req: Request, mut res: Response) {
    match req.header("X-Require-Admin") {
        Option.Some(required) {
            match req.header("Authorization") {
                Option.Some(token) {
                    if token != "Bearer salon-admin-secret-token" {
                        log.error("Tentativa de acesso nao autorizado", {
                            token: token,
                            reason: "invalid_bearer_token"
                        });
                        res.error(401, "Token administrativo invalido ou expirado");
                    }
                },
                Option.None {
                    log.error("Acesso bloqueado: header Authorization ausente", {
                        endpoint: "protected_admin"
                    });
                    res.error(401, "Acesso restrito: informe o header Authorization");
                }
            }
        },
        Option.None {
            // Rota publica ou sem exigencia de perfil admin restrito
        }
    }
}
