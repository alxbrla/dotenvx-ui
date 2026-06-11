import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import type { EnvFile } from "./types.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".turbo",
  "build",
  ".cache",
]);

export function detectRoot(cwd: string): string {
  let dir = cwd;
  while (true) {
    try {
      statSync(join(dir, ".git"));
      return dir;
    } catch {}

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}


export function scanForEnvFiles(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (isEnvFile(entry)) {
          results.push(full);
        }
      } catch {}
    }
  }

  walk(root);
  return results;
}

function isEnvFile(name: string): boolean {
  if (name === ".env.keys") return false;
  return name === ".env" || name.startsWith(".env.");
}

export function parseEnvironmentFromFilename(filename: string): string {
  const name = basename(filename);
  if (name === ".env") return "default";
  const suffix = name.slice(".env.".length);
  return suffix || "default";
}

export function scan(cwd: string): EnvFile[] {
  const root = detectRoot(cwd);
  const paths = scanForEnvFiles(root);

  return paths.map((filePath) => {
    const rel = relative(root, filePath);
    const pkg = relative(root, dirname(filePath)) || ".";
    const environment = parseEnvironmentFromFilename(basename(filePath));

    let content = "";
    try {
      content = readFileSync(filePath, "utf8");
    } catch {}

    const hasPublicKey = content.includes("DOTENV_PUBLIC_KEY=");
    const encrypted = /encrypted:/.test(content);

    return {
      path: filePath,
      relativePath: rel,
      package: pkg,
      environment,
      encrypted,
      hasPublicKey,
      keys: [],
    };
  });
}
