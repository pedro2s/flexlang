import * as fs from "fs";
import * as path from "path";
import { loadModuleGraph } from "../src/loader";
import { Interpreter } from "../src/interpreter";
import { TypeChecker } from "../src/checker";
import { registry } from "../src/modules/registry";
import { echoModule } from "../src/modules/echo";
import { FlexError, formatDiagnostic } from "../src/diagnostics";

// Módulo nativo fictício, disponível só para a suíte (RFC-003)
registry.register(echoModule);

const testsDir = path.join(process.cwd(), "tests");

async function runTests() {
  const files = fs.readdirSync(testsDir);
  const flexFiles = files.filter(f => f.endsWith(".flex"));
  
  let passed = 0;
  let failed = 0;
  
  console.log(`\nRunning ${flexFiles.length} golden tests...\n`);

  for (const file of flexFiles) {
    const flexPath = path.join(testsDir, file);
    const outPath = path.join(testsDir, file.replace(".flex", ".out"));
    
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
      // Capture errors in output as well!
      if (e instanceof FlexError) {
        capturedOutput += formatDiagnostic(e, { isTTY: false }) + "\n";
      } else {
        capturedOutput += e.message + "\n";
      }
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
