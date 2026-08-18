// Configurações do FlexBank API (RFC-024, RFC-026)

import { env } from "os/env";

const DEFAULT_PORT: String = "3001";
const MAX_RETRIES: Int = 3;
const API_VERSION: String = "v0.3.0";

func get_server_port() -> String {
    return env.get_or("FLEXBANK_PORT", DEFAULT_PORT);
}

func get_app_env() -> String {
    return env.get_or("FLEXBANK_ENV", "production");
}
