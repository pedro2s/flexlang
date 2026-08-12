import { Server, Request, Response } from "net/http";

func handle_users(req: Request, mut res: Response) {
    let resposta = "Alo, Mundo! Esta eh a FlexLang rodando na web!";
    res.json(resposta);
}

let server = Server.new(":8080");
server.route("/users", handle_users);

print("Subindo o servidor em http://localhost:8080/users ...");
server.start();
