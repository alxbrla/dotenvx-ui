import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectRoot,
  scanForEnvFiles,
  parseEnvironmentFromFilename,
  scan,
} from "../core/scanner.js";

function fixture(): string {
  return mkdtempSync(join(tmpdir(), "dotenvx-ui-test-"));
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

// --- parseEnvironmentFromFilename ---

test("parseEnvironmentFromFilename: .env → default", () => {
  assert.equal(parseEnvironmentFromFilename(".env"), "default");
});

test("parseEnvironmentFromFilename: .env.local → local", () => {
  assert.equal(parseEnvironmentFromFilename(".env.local"), "local");
});

test("parseEnvironmentFromFilename: .env.production → production", () => {
  assert.equal(parseEnvironmentFromFilename(".env.production"), "production");
});

test("parseEnvironmentFromFilename: .env.staging → staging", () => {
  assert.equal(parseEnvironmentFromFilename(".env.staging"), "staging");
});

// --- detectRoot ---

test("detectRoot: returns cwd when no .git found", () => {
  const dir = fixture();
  try {
    assert.equal(detectRoot(dir), dir);
  } finally {
    cleanup(dir);
  }
});

test("detectRoot: walks up to find .git", () => {
  const dir = fixture();
  try {
    mkdirSync(join(dir, ".git"));
    const child = join(dir, "apps", "web");
    mkdirSync(child, { recursive: true });
    assert.equal(detectRoot(child), dir);
  } finally {
    cleanup(dir);
  }
});

// --- scanForEnvFiles ---

test("scanForEnvFiles: finds .env and .env.* files", () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, ".env"), "FOO=bar");
    writeFileSync(join(dir, ".env.local"), "FOO=local");
    writeFileSync(join(dir, ".env.production"), "FOO=prod");
    writeFileSync(join(dir, "index.ts"), "// not an env file");

    const found = scanForEnvFiles(dir);
    assert.equal(found.length, 3);
    assert.ok(found.some((f) => f.endsWith(".env")));
    assert.ok(found.some((f) => f.endsWith(".env.local")));
    assert.ok(found.some((f) => f.endsWith(".env.production")));
  } finally {
    cleanup(dir);
  }
});

test("scanForEnvFiles: skips node_modules", () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, ".env"), "FOO=bar");
    const nm = join(dir, "node_modules", "some-pkg");
    mkdirSync(nm, { recursive: true });
    writeFileSync(join(nm, ".env"), "SECRET=leaked");

    const found = scanForEnvFiles(dir);
    assert.equal(found.length, 1);
    assert.ok(found[0]!.endsWith(".env"));
    assert.ok(!found[0]!.includes("node_modules"));
  } finally {
    cleanup(dir);
  }
});

test("scanForEnvFiles: skips dist, .git, .next, .turbo, build", () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, ".env"), "ROOT=1");
    for (const skip of ["dist", ".git", ".next", ".turbo", "build"]) {
      const sub = join(dir, skip);
      mkdirSync(sub, { recursive: true });
      writeFileSync(join(sub, ".env"), "SKIP=yes");
    }

    const found = scanForEnvFiles(dir);
    assert.equal(found.length, 1);
  } finally {
    cleanup(dir);
  }
});

test("scanForEnvFiles: walks nested directories", () => {
  const dir = fixture();
  try {
    const nested = join(dir, "apps", "web");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(dir, ".env"), "ROOT=1");
    writeFileSync(join(nested, ".env.local"), "WEB=1");

    const found = scanForEnvFiles(dir);
    assert.equal(found.length, 2);
  } finally {
    cleanup(dir);
  }
});

// --- scan ---

test("scan: returns EnvFile array with correct metadata", () => {
  const dir = fixture();
  try {
    writeFileSync(join(dir, ".env"), "FOO=bar\nBAR=baz");
    writeFileSync(
      join(dir, ".env.local"),
      "DOTENV_PUBLIC_KEY=abc\nSECRET=encrypted:xyz"
    );
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app" }));

    const files = scan(dir);
    assert.equal(files.length, 2);

    const plain = files.find((f) => f.environment === "default")!;
    assert.ok(plain);
    assert.equal(plain.encrypted, false);
    assert.equal(plain.hasPublicKey, false);
    assert.equal(plain.package, ".");

    const local = files.find((f) => f.environment === "local")!;
    assert.ok(local);
    assert.equal(local.hasPublicKey, true);
    assert.equal(local.encrypted, true);
  } finally {
    cleanup(dir);
  }
});
