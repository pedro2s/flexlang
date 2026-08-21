import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";
import { execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

async function main() {
    const cwd = process.cwd();
    const fixturePath = path.join(cwd, "tests", "fixtures", "40_fs_path.flex");
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
    
    const goFile = path.join(os.tmpdir(), "40_fs_path_bench.go");
    fs.writeFileSync(goFile, goCode);

    try {
        goOut = execFileSync("go", ["run", goFile], { encoding: "utf-8" }).trim();
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

    console.log("40_fs_path (FS & Path) PASSED Parity Check!");
}

main().catch((e) => {
    console.error("Runner Fatal Error:", e);
    process.exit(1);
});
