import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = path.resolve("src");

const collectJavaScript = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScript(filePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [filePath] : [];
  });

let failed = false;
for (const filePath of collectJavaScript(sourceRoot)) {
  const result = spawnSync(process.execPath, ["--check", filePath], { stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

if (failed) process.exitCode = 1;
