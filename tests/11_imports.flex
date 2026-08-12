// Teste 11: Modulos e Injeção de Stubs

import { Server, Request, Response } from "net/http";

let server = Server.new(":8080");
print("Servidor injetado e reconhecido!");
