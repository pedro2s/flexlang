#!/usr/bin/env -S npx tsx

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { TypeChecker } from "./checker";
import { Interpreter } from "./interpreter";
import { GoTranspiler } from "./transpiler";

function printUsage() {
    console.log(`🚀 FlexLang CLI

Usage:
  flex run <file.flex>    - Interprets and runs the file locally via Node.js
  flex build <file.flex>  - Transpiles to Go and compiles to a native binary
`);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        printUsage();
        process.exit(1);
    }
    
    const command = args[0];
    const filePath = args[1];
    
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File '${filePath}' not found.`);
        process.exit(1);
    }
    
    const code = fs.readFileSync(filePath, "utf-8");
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const checker = new TypeChecker();
    checker.check(ast);
    
    if (command === "run") {
        console.log(`[flex] Running ${filePath} in interpreted mode...\n`);
        const interpreter = new Interpreter();
        await interpreter.run(ast);
    } else if (command === "build") {
        console.log(`[flex] Transpiling ${filePath} to Go...`);
        const transpiler = new GoTranspiler();
        const goCode = transpiler.transpile(ast);
        
        const baseName = path.basename(filePath, ".flex");
        const outGo = `${baseName}.go`;
        fs.writeFileSync(outGo, goCode);
        
        console.log(`[flex] Transpiled successfully to ${outGo}`);
        console.log(`[flex] Compiling native binary using 'go build'...`);
        
        try {
            execSync(`go build -o ${baseName} ${outGo}`, { stdio: 'inherit' });
            console.log(`\n✅ Build complete! Executable is ready at: ./${baseName}`);
        } catch (e) {
            console.error(`\n⚠️ Warning: 'go build' failed. Do you have Go installed?`);
            console.error(`The transpilated Go source file is available at ${outGo}`);
        }
    } else {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
}

main().catch(console.error);
