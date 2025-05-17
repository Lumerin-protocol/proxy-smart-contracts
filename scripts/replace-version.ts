import { readFileSync } from "node:fs";
import path, { join } from "node:path";
import { replaceInFiles } from "./lib/replace-in-files";

const rootDir = process.cwd();
const VERSION_FILE = join(rootDir, "VERSION");
const CONTRACTS_DIR = join(rootDir, "contracts");
const EXTENSIONS = [".sol"];
const REPLACE_FROM = '"{{VERSION}}"';
// Read version from VERSION file
const REPLACE_TO = readFileSync(VERSION_FILE, "utf-8").trim();

console.log("🔧 Patching solidity files...");
console.log(`📁 Scanning folder: ${path.relative(rootDir, CONTRACTS_DIR)}`);
console.log(`🔍 Looking for files with extensions: ${EXTENSIONS.join(", ")}`);
console.log(`🔄 Replacing imports: "${REPLACE_FROM}" → "${REPLACE_TO}"`);
console.log("---");

const updatedFilesCount = replaceInFiles(
  CONTRACTS_DIR,
  [{ from: '"{{VERSION}}"', to: `"${REPLACE_TO}"` }],
  EXTENSIONS
);

console.log(`✅ Version replacement complete. Updated ${updatedFilesCount} files.`);
