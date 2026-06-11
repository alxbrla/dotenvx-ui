import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const exec = promisify(execFile);
const cli = resolve(fileURLToPath(import.meta.url), "../../../dist/cli.js");

async function run(...args: string[]) {
  return runIn(process.cwd(), ...args);
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

test("no env files exits with code 1", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dotenvx-ui-cli-"));
  try {
    const { stderr, code } = await runIn(dir);
    assert.equal(code, 1);
    assert.ok(stderr.includes("No .env files found"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function runIn(cwd: string, ...args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const r = await exec("node", [cli, ...args], { cwd });
    return { stdout: r.stdout, stderr: r.stderr, code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; code: number };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
}
