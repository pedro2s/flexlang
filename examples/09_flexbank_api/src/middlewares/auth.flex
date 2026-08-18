// Middlewares do FlexBank (RFC-015, RFC-027, RFC-028)

import { Request, Response } from "net/http";
import { uuid } from "crypto";
import { log } from "core/log";

func correlation_middleware(req: Request, mut res: Response) {
    let existing_corr = req.header("x-correlation-id");
    let mut corr_id = "";
    match existing_corr {
        Option.Some(cid) { corr_id = cid; },
        Option.None { corr_id = uuid.v4(); }
    }
    res.header("X-Correlation-ID", corr_id);
    log.info("Request recebido", {
        correlation_id: corr_id
    });
}
