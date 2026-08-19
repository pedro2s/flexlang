import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";
import { execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Interpreter } from "../src/interpreter";

function createMockEnv(dir: string) {
    const content = `
FLEX_API_KEY="sk_test_12345"
FLEX_ENDPOINT="https://api.flexlang.org/v1/\${FLEX_API_KEY}"
# Comentario teste
IGNORE_ME="sim"
`;
    fs.writeFileSync(path.join(dir, ".env.test"), content.trim());
}

function removeMockEnv(dir: string) {
    const file = path.join(dir, ".env.test");
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}

async function main() {
    const cwd = process.cwd();
    createMockEnv(cwd);

    try {
        const fixturePath = path.join(cwd, "tests", "fixtures", "38_dotenv.flex");
        const graph = loadModuleGraph(fixturePath);
        const typeChecker = new TypeChecker();
        typeChecker.check(graph);

        let tsOut = "";
        let goOut = "";

        // 1. Run Node/TS
        const result = execFileSync("npx", ["tsx", "src/cli.ts", "run", fixturePath], { encoding: "utf-8" });
        tsOut = result.toString();
        // Remove Flex CLI logs
        const lines = tsOut.split("\n").filter(l => !l.startsWith("[flex]"));
        tsOut = lines.join("\n").trim();

        // 2. Compile and Run Go
        const transpiler = new GoTranspiler();
        let goCode = transpiler.transpile(graph);
        goCode = goCode.replace("func main() {\n}", "func main() {\n\tflex_main()\n}");
        const goFile = path.join(os.tmpdir(), "38_dotenv_bench.go");
        fs.writeFileSync(goFile, goCode);

        try {
            goOut = execFileSync("go", ["run", goFile], { encoding: "utf-8" });
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

        console.log("38_dotenv (Dotenv Config) PASSED Parity Check!");

    } finally {
        removeMockEnv(cwd);
    }
}

main().catch((e) => {
    console.error("Runner Fatal Error:", e);
    process.exit(1);
});
