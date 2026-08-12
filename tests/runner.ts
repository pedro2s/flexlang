import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { Interpreter } from "../src/interpreter";

const testsDir = path.join(process.cwd(), "tests");

function runTests() {
  const files = fs.readdirSync(testsDir);
  const flexFiles = files.filter(f => f.endsWith(".flex"));
  
  let passed = 0;
  let failed = 0;
  
  console.log(`\nRunning ${flexFiles.length} golden tests...\n`);

  for (const file of flexFiles) {
    const flexPath = path.join(testsDir, file);
    const outPath = path.join(testsDir, file.replace(".flex", ".out"));
    
    const sourceCode = fs.readFileSync(flexPath, "utf-8");
    
    let capturedOutput = "";
    const stdout = (msg: string) => {
      capturedOutput += msg + "\n";
    };

    try {
      const lexer = new Lexer(sourceCode);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      const interpreter = new Interpreter(stdout);
      interpreter.run(ast);
    } catch (e: any) {
      // Capture errors in output as well!
      capturedOutput += e.message + "\n";
    }

    if (!fs.existsSync(outPath)) {
      // Auto-generate the golden file if it doesn't exist
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

runTests();
