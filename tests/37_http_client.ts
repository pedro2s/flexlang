import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { execFileSync } from "child_process";
import { loadModuleGraph } from "../src/loader";
import { Interpreter } from "../src/interpreter";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";

const PORT = 3037;

const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
        if (req.method === "GET" && req.url === "/ping") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ pong: true }));
        } else if (req.method === "POST" && req.url === "/echo") {
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(body);
        } else {
            res.writeHead(404);
            res.end("Not Found");
        }
    });
});

async function main() {
    await new Promise<void>((resolve) => {
        mockServer.listen(PORT, () => {
            resolve();
        });
    });

    const fixturePath = path.join(process.cwd(), "tests", "fixtures", "37_http_client.flex");
    const graph = loadModuleGraph(fixturePath);
    const typeChecker = new TypeChecker();
    typeChecker.check(graph);

    let tsOut = "";
    let goOut = "";

    // 1. Run Interpreter
    const interpreter = new Interpreter((msg) => { tsOut += msg + "\n"; });
    await interpreter.run(graph);

    // 2. Run Go Transpiler
    const transpiler = new GoTranspiler();
    const goCode = transpiler.transpile(graph);
    
    const goPath = path.join(os.tmpdir(), "37_http_client_bench.go");
    fs.writeFileSync(goPath, goCode);
    
    const goBin = execFileSync("go", ["env", "GOMOD"])[0] ? "go" : "/usr/local/go/bin/go"; 
    // Fallback: Just run go run
    try {
        goOut = execFileSync("go", ["run", goPath], { encoding: "utf-8" });
    } catch(e: any) {
        console.error("Go Run failed:", e.stdout || e.stderr || e.message);
        throw e;
    }

    if (tsOut.trim() !== goOut.trim()) {
        console.error("Parity failed!");
        console.error("TS Output:\n", tsOut);
        console.error("Go Output:\n", goOut);
        process.exit(1);
    } else {
        console.log("37_http_client (Client HTTP) PASSED Parity Check!");
        console.log(tsOut);
    }
}

import * as os from "os";

main().catch(e => {
    console.error(e);
}).finally(() => {
    mockServer.close();
    process.exit(0);
});
