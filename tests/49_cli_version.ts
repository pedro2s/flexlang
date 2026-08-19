import { execSync } from "child_process";
import * as path from "path";

// Testes automatizados para flags de versão e ajuda da CLI FlexLang
console.log("Running CLI version & help integration tests...");

const cliPath = path.resolve("dist/cli.js");

// 1. Testa --version
const versionOutput = execSync(`node ${cliPath} --version`, { encoding: "utf-8" }).trim();
if (versionOutput !== "flex version 0.3.0") {
    console.error(`❌ Expected 'flex version 0.3.0', got '${versionOutput}'`);
    process.exit(1);
}
console.log("✅ [PASS] flex --version");

// 2. Testa -v
const vOutput = execSync(`node ${cliPath} -v`, { encoding: "utf-8" }).trim();
if (vOutput !== "flex version 0.3.0") {
    console.error(`❌ Expected 'flex version 0.3.0', got '${vOutput}'`);
    process.exit(1);
}
console.log("✅ [PASS] flex -v");

// 3. Testa flex version
const versionSubOutput = execSync(`node ${cliPath} version`, { encoding: "utf-8" }).trim();
if (versionSubOutput !== "flex version 0.3.0") {
    console.error(`❌ Expected 'flex version 0.3.0', got '${versionSubOutput}'`);
    process.exit(1);
}
console.log("✅ [PASS] flex version");

// 4. Testa --help
const helpOutput = execSync(`node ${cliPath} --help`, { encoding: "utf-8" });
if (!helpOutput.includes("Usage:") || !helpOutput.includes("--version")) {
    console.error(`❌ Expected help output containing '--version', got:\n${helpOutput}`);
    process.exit(1);
}
console.log("✅ [PASS] flex --help");

console.log("\nAll CLI version tests passed successfully! 🎉\n");
