#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { loadModuleGraph } from "./loader";
import { TypeChecker } from "./checker";
import { Interpreter } from "./interpreter";
import { GoTranspiler } from "./transpiler";

function printUsage() {
    console.log(`🚀 FlexLang CLI

Usage:
  flex init <name>        - Creates a new FlexLang project
  flex run <file.flex>    - Interprets and runs the file locally via Node.js
  flex build <file.flex>  - Transpiles to Go and compiles to a native binary
  flex test [path]        - Runs golden file tests (matches *_test.flex)
`);
}

async function runInit(projectName: string) {
    if (!projectName) {
        console.error("Error: Missing project name. Usage: flex init <name>");
        process.exit(1);
    }

    const projectDir = path.join(process.cwd(), projectName);
    if (fs.existsSync(projectDir)) {
        console.error(`Error: Directory '${projectName}' already exists.`);
        process.exit(1);
    }

    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, "tests"));
    fs.mkdirSync(path.join(projectDir, "src", "modules", "health"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "src", "shared"), { recursive: true });

    const tomlContent = `[package]
name = "${projectName}"
version = "0.1.0"
entry = "src/main.flex"
`;
    fs.writeFileSync(path.join(projectDir, "flex.toml"), tomlContent);

    const mainContent = `import { health_check } from "./modules/health/handler";

func main() {
    print("Starting ${projectName}...");
    health_check();
}

main();
`;
    fs.writeFileSync(path.join(projectDir, "src", "main.flex"), mainContent);

    const handlerContent = `func health_check() {
    print("Health: OK");
}
`;
    fs.writeFileSync(path.join(projectDir, "src", "modules", "health", "handler.flex"), handlerContent);

    const testContent = `import { health_check } from "../src/modules/health/handler";

func main() {
    health_check();
}

main();
`;
    fs.writeFileSync(path.join(projectDir, "tests", "health_test.flex"), testContent);
    fs.writeFileSync(path.join(projectDir, "tests", "health_test.out"), "Health: OK\n");

    console.log(`✅ Project '${projectName}' created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${projectName}`);
    console.log(`  flex test`);
    console.log(`  flex run src/main.flex`);
}

async function runRun(filePath: string) {
    if (!filePath) {
        console.error("Error: Missing file path. Usage: flex run <file.flex>");
        process.exit(1);
    }
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File '${filePath}' not found.`);
        process.exit(1);
    }

    const graph = loadModuleGraph(filePath);
    const checker = new TypeChecker();
    checker.check(graph);

    console.log(`[flex] Running ${filePath} in interpreted mode...\n`);
    const interpreter = new Interpreter();
    await interpreter.run(graph);
}

async function runBuild(filePath: string) {
    if (!filePath) {
        console.error("Error: Missing file path. Usage: flex build <file.flex>");
        process.exit(1);
    }
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File '${filePath}' not found.`);
        process.exit(1);
    }

    const graph = loadModuleGraph(filePath);
    const checker = new TypeChecker();
    const types = checker.check(graph);

    console.log(`[flex] Transpiling ${filePath} to Go...`);
    const transpiler = new GoTranspiler();
    const goCode = transpiler.transpile(graph, types);
    
    const baseName = path.basename(filePath, ".flex");
    const buildDir = path.join(process.cwd(), "build");
    
    if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
    }

    const outGo = path.join(buildDir, `${baseName}.go`);
    const outBin = path.join(buildDir, baseName);
    
    fs.writeFileSync(outGo, goCode);
    
    console.log(`[flex] Transpiled successfully to ${outGo}`);
    console.log(`[flex] Compiling native binary using 'go build'...`);
    
    try {
        execSync(`go build -o ${outBin} ${outGo}`, { stdio: 'inherit' });
        console.log(`\n✅ Build complete! Executable is ready at: ${outBin}`);
    } catch (e: any) {
        console.error(`\n⚠️ Build Error: 'go build' failed.`);
        
        const errMsg = e.message || "";
        const stderr = e.stderr ? e.stderr.toString() : "";
        const combinedErr = errMsg + " " + stderr;

        if (combinedErr.includes("executable file not found in $PATH") || combinedErr.includes("command not found")) {
            console.error(`Go compiler not found. Do you have Go installed and in your PATH?`);
        } else {
            console.error(`Compilation error in the generated Go code (Possible FlexLang Transpiler bug):`);
            console.error(stderr || errMsg);
        }
        
        console.error(`The transpilated Go source file is available at ${outGo}`);
        process.exit(1);
    }
}

function findTestFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findTestFiles(fullPath, fileList);
        } else if (fullPath.endsWith("_test.flex")) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

async function runTest(targetPath: string) {
    const searchPath = targetPath ? path.resolve(targetPath) : process.cwd();
    
    if (!fs.existsSync(searchPath)) {
        console.error(`Error: Path '${searchPath}' not found.`);
        process.exit(1);
    }

    let testFiles: string[] = [];
    if (fs.statSync(searchPath).isDirectory()) {
        testFiles = findTestFiles(searchPath);
    } else if (searchPath.endsWith("_test.flex")) {
        testFiles.push(searchPath);
    } else {
        console.error(`Error: Provided path is not a directory or a *_test.flex file.`);
        process.exit(1);
    }

    if (testFiles.length === 0) {
        console.log(`No *_test.flex files found in ${searchPath}.`);
        return;
    }

    let passed = 0;
    let failed = 0;
    
    console.log(`\nRunning ${testFiles.length} test(s)...\n`);

    for (const flexPath of testFiles) {
        const file = path.basename(flexPath);
        const outPath = flexPath.replace(".flex", ".out");
        
        let capturedOutput = "";
        const stdout = (msg: string) => {
            capturedOutput += msg + "\n";
        };

        try {
            const graph = loadModuleGraph(flexPath);
            const typeChecker = new TypeChecker();
            typeChecker.check(graph);

            const interpreter = new Interpreter(stdout);
            await interpreter.run(graph);
        } catch (e: any) {
            capturedOutput += e.message + "\n";
        }

        if (!fs.existsSync(outPath)) {
            fs.writeFileSync(outPath, capturedOutput, "utf-8");
            console.log(`\x1b[33m[GENERATED]\x1b[0m ${file}`);
            passed++;
            continue;
        }

        const expectedOutput = fs.readFileSync(outPath, "utf-8");
        
        if (capturedOutput === expectedOutput) {
            console.log(`\x1b[32m[PASS]\x1b[0m ${file}`);
            passed++;
        } else {
            console.log(`\x1b[31m[FAIL]\x1b[0m ${file}`);
            console.log(`\n--- Expected ---\n${expectedOutput}`);
            console.log(`--- Got ---\n${capturedOutput}\n`);
            failed++;
        }
    }

    console.log(`\nTests Completed: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        printUsage();
        process.exit(1);
    }
    
    const command = args[0];
    
    if (command === "init") {
        await runInit(args[1]);
    } else if (command === "run") {
        await runRun(args[1]);
    } else if (command === "build") {
        await runBuild(args[1]);
    } else if (command === "test") {
        await runTest(args[1]);
    } else {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
