import fs from "node:fs";
import path from "node:path";
import { replaceInFiles } from "./lib/replace-in-files";

const REPLACE_FROM = /@openzeppelin\/contracts/g;
const REPLACE_TO = "@openzeppelin/contracts-v5";
const PACKAGE_NAME = "@openzeppelin/contracts-upgradeable-v5";
const EXTENSIONS = [".sol"];

const rootDir = process.cwd();
const targetPackagePath = path.join(rootDir, "node_modules", PACKAGE_NAME);

if (!fs.existsSync(targetPackagePath)) {
  console.error(`❌ ${PACKAGE_NAME} not found in node_modules/${PACKAGE_NAME}`);
  process.exit(1);
}

console.log("🔧 Patching OpenZeppelin v5 internal imports...");
console.log();
console.log(`📁 Scanning folder: ${path.relative(rootDir, targetPackagePath)}`);
console.log(`🔍 Looking for files with extensions: ${EXTENSIONS.join(", ")}`);
console.log(`🔄 Replacing imports: "${REPLACE_FROM}" → "${REPLACE_TO}"`);
console.log("---");

const patchedFilesCount = replaceInFiles(
  targetPackagePath,
  [{ from: REPLACE_FROM, to: REPLACE_TO }],
  EXTENSIONS
);

console.log(`✅ Patched ${patchedFilesCount} files.`);
