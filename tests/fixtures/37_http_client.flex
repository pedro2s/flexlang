import { Client, ClientConfig, ClientResponse } from "net/http";

func main() {
    print("Iniciando Teste Cliente HTTP...");

    let config = ClientConfig {
        timeout_ms: 2000
    };
    let client = Client.new(config);

    // 1. GET simples
    let res1 = client.get("http://localhost:3037/ping");
    match res1 {
        Result.Ok(res) {
            print("GET status: ${ClientResponse.status(res)}");
            print("GET body: ${ClientResponse.body(res)}");
        },
        Result.Err(err) {
            print("GET falhou: ${err}");
        }
    }

    // 2. POST JSON
    let payload = {
        "message": "hello"
    };
    let res2 = client.post_json("http://localhost:3037/echo", payload);
    match res2 {
        Result.Ok(res) {
            print("POST status: ${ClientResponse.status(res)}");
            print("POST body: ${ClientResponse.body(res)}");
        },
        Result.Err(err) {
            print("POST falhou: ${err}");
        }
    }
}
