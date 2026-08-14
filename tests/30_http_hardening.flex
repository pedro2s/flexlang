import { Server, Request, Response } from "net/http";

let server = Server.new(":8080");

server.route("/panic", |req: Request, res: Response| {
    // Cause a panic (force an out-of-bounds panic)
    let arr = [1];
    print(arr[10]);
});

server.on_shutdown(|| {
    print("Graceful shutdown hook triggered!");
});

// server.start() is intentionally omitted so the golden test doesn't hang!
print("HTTP server configured.");
