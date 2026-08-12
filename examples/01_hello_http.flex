// FlexLang: Hello World Web Server

import { Server, Request, Response } from "net/http";

func handle_request(req: Request, mut res: Response) {
    let message = "Bem-vindo a FlexLang! Sua linguagem focada no Backend.";
    res.json(message);
}

// Inicia um servidor escutando na porta 8080
let mut server = Server.new(":8080");
server.route("/", handle_request);

print("🚀 Servidor online! Acesse: http://localhost:8080/");
server.start();
