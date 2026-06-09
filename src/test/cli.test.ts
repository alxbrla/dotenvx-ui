import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const cli = resolve(fileURLToPath(import.meta.url), "../../../dist/cli.js");

async function run(...args: string[]) {
  try {
    return await exec("node", [cli, ...args]);
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; code: number };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
}

test("--version prints version", async () => {
  const { stdout } = await run("--version");
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("-v prints version", async () => {
  const { stdout } = await run("-v");
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("--help prints usage", async () => {
  const { stdout } = await run("--help");
  assert.ok(stdout.includes("dotenvx-ui"));
  assert.ok(stdout.includes("Usage:"));
  assert.ok(stdout.includes("--version"));
  assert.ok(stdout.includes("--help"));
});

test("-h prints usage", async () => {
  const { stdout } = await run("-h");
  assert.ok(stdout.includes("dotenvx-ui"));
  assert.ok(stdout.includes("Usage:"));
});
