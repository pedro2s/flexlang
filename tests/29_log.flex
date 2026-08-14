import { log } from "core/log";

log.info("App started", { version: "1.0", env: "test" });
log.error("Something went wrong", { code: 500, reason: "Timeout" });
