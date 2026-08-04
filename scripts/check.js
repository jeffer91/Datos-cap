"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED = new Set(["node_modules", ".git", "dist", "build", "out"]);

function collectJavaScript(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScript(fullPath, output);
    else if (entry.isFile() && entry.name.endsWith(".js")) output.push(fullPath);
  }
  return output;
}

const files = collectJavaScript(ROOT);
let failed = false;
for (const filePath of files) {
  const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    console.error(`\nError de sintaxis: ${path.relative(ROOT, filePath)}`);
    console.error(result.stderr || result.stdout);
  }
}

if (failed) process.exit(1);
console.log(`Sintaxis correcta: ${files.length} archivos JavaScript.`);
