import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";
import { execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

async function main() {
    const cwd = process.cwd();
    const fixturePath = path.join(cwd, "tests", "fixtures", "41_jwt.flex");
    const graph = loadModuleGraph(fixturePath);
    const typeChecker = new TypeChecker();
    typeChecker.check(graph);

    let tsOut = "";
    let goOut = "";

    // 1. Run Node/TS
    const result = execFileSync("npx", ["tsx", "src/cli.ts", "run", fixturePath], { encoding: "utf-8" });
    tsOut = result.toString();
    const lines = tsOut.split("\n").filter(l => !l.startsWith("[flex]"));
    tsOut = lines.join("\n").trim();

    // 2. Compile and Run Go
    const transpiler = new GoTranspiler();
    let goCode = transpiler.transpile(graph);
    
    if (goCode.includes("func flex_init() {")) {
       goCode = goCode.replace("func main() {\n}", "func main() {\n\tflex_init()\n}");
    }
    
    // Create Temporary Project for Go Modules
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flexlang_jwt_"));
    const goFile = path.join(tmpDir, "main.go");
    fs.writeFileSync(goFile, goCode);

    try {
        // Init module and fetch third-party deps
        execFileSync("go", ["mod", "init", "flex_bench"], { cwd: tmpDir });
        for (const dep of transpiler.thirdPartyDeps) {
            execFileSync("go", ["get", dep], { cwd: tmpDir });
        }
        goOut = execFileSync("go", ["run", "main.go"], { cwd: tmpDir, encoding: "utf-8" }).trim();
    } catch (e: any) {
        console.error("Go Run failed:", e.stdout || e.stderr || e.message);
        throw e;
    }

    // Normalize
    const normTs = tsOut.replace(/\r\n/g, "\n").trim();
    const normGo = goOut.replace(/\r\n/g, "\n").trim();

    if (normTs !== normGo) {
        console.error("Parity mismatch!");
        console.error("--- TS Output ---");
        console.error(normTs);
        console.error("--- Go Output ---");
        console.error(normGo);
        process.exit(1);
    }

    console.log("41_jwt (JWT Crypto) PASSED Parity Check!");
}

main().catch((e) => {
    console.error("Runner Fatal Error:", e);
    process.exit(1);
});
