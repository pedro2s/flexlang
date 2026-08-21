import { loadModuleGraph } from "../src/loader";
import { TypeChecker } from "../src/checker";
import { GoTranspiler } from "../src/transpiler";
import { execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

async function main() {
    const cwd = process.cwd();
    const fixturePath = path.join(cwd, "tests", "fixtures", "39_encoding.flex");
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
    // As Fixtures Top Level geram init() que o transpiler envelopa implicitamente na init_XX se precisarmos?
    // Na verdade, FlexLang tem flex_main() se tiver um main, mas para statements soltos o GoTranspiler 
    // os coloca no init() do arquivo?
    // Flexlang cria 'func flex_init()' para globais e não os executa automaticamente na main.
    // Vamos injetar chamadas flex_init() ou flex_main() na main gerada, para rodar na nossa Sandbox Go!
    // Se tiver flex_init() na fixture compilada, nós garantiremos sua invocação
    
    // O Transpiler injeta 'func main() {\n}' no final. Substituimos e invocamos o flex_init.
    if (goCode.includes("func flex_init() {")) {
       goCode = goCode.replace("func main() {\n}", "func main() {\n\tflex_init()\n}");
    }
    
    const goFile = path.join(os.tmpdir(), "39_encoding_bench.go");
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

    console.log("39_encoding (Encoding & JSON) PASSED Parity Check!");
}

main().catch((e) => {
    console.error("Runner Fatal Error:", e);
    process.exit(1);
});
