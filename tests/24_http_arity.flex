// Teste 24: Server.new aceita 1 ou 2 argumentos (addr, ServerConfig opcional) -
// alem disso e erro de aridade (RFC-004).

import { Server, Request, Response } from "net/http";

let server = Server.new(":8080", ServerConfig { read_timeout: 1000, max_body_size: 1000 }, "demais");
