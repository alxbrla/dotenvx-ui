import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  addKey,
  readEnvFile,
  removeKey,
  updateKey,
  writeEnvFile,
} from "../core/parser/index.js";

function fixture(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "dotenvx-ui-parser-"));
  const file = join(dir, ".env");
  writeFileSync(file, content);
  return file;
}

function cleanup(file: string) {
  rmSync(join(file, ".."), { recursive: true, force: true });
}

function read(file: string) {
  return readFileSync(file, "utf8");
}

// --- readEnvFile ---

test("reads plain key=value", () => {
  const f = fixture("FOO=bar\nBAZ=qux\n");
  try {
    const keys = readEnvFile(f);
    assert.equal(keys.length, 2);
    assert.equal(keys[0]!.key, "FOO");
    assert.equal(keys[0]!.value, "bar");
    assert.equal(keys[1]!.key, "BAZ");
    assert.equal(keys[1]!.value, "qux");
  } finally {
    cleanup(f);
  }
});

test("reads double-quoted value", () => {
  const f = fixture(`KEY="hello world"\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.value, "hello world");
  } finally {
    cleanup(f);
  }
});

test("reads single-quoted value", () => {
  const f = fixture(`KEY='hello world'\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.value, "hello world");
  } finally {
    cleanup(f);
  }
});

test("reads multiline value with escaped \\n", () => {
  const f = fixture(`KEY="line one\\nline two"\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.value, "line one\nline two");
  } finally {
    cleanup(f);
  }
});

test("reads multiline value with real newlines inside quotes", () => {
  const f = fixture(`KEY="line one\nline two"\nOTHER=after\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.key, "KEY");
    assert.equal(keys[0]!.value, "line one\nline two");
    assert.equal(keys[1]!.key, "OTHER");
    assert.equal(keys[1]!.value, "after");
  } finally {
    cleanup(f);
  }
});

test("reads SSH private key style multiline", () => {
  const pem =
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----";
  const f = fixture(`SSH_KEY="${pem.replace(/\n/g, "\\n")}"\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.value, pem);
  } finally {
    cleanup(f);
  }
});

test("preserves comment as key.comment", () => {
  const f = fixture(`# database connection\nDB_URL=postgres://localhost\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.comment, "database connection");
  } finally {
    cleanup(f);
  }
});

test("skips comment-only lines and blank lines", () => {
  const f = fixture(`# header\n\nFOO=bar\n\n# trailing comment\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys.length, 1);
    assert.equal(keys[0]!.key, "FOO");
  } finally {
    cleanup(f);
  }
});

test("marks encrypted: values as encrypted", () => {
  const f = fixture(`SECRET=encrypted:abc123\n`);
  try {
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.encrypted, true);
  } finally {
    cleanup(f);
  }
});

// --- round-trip ---

test("round-trip: write back unchanged keys produces identical file", () => {
  const original = `# App config\nFOO=bar\nBAZ="hello world"\n\n# DB\nDB_URL=postgres://localhost\n`;
  const f = fixture(original);
  try {
    const keys = readEnvFile(f);
    writeEnvFile(f, keys);
    assert.equal(read(f), original);
  } finally {
    cleanup(f);
  }
});

test("round-trip: preserves blank lines between keys", () => {
  const original = `A=1\n\nB=2\n\nC=3\n`;
  const f = fixture(original);
  try {
    writeEnvFile(f, readEnvFile(f));
    assert.equal(read(f), original);
  } finally {
    cleanup(f);
  }
});

test("round-trip: preserves comments above keys", () => {
  const original = `# first\nA=1\n# second\nB=2\n`;
  const f = fixture(original);
  try {
    writeEnvFile(f, readEnvFile(f));
    assert.equal(read(f), original);
  } finally {
    cleanup(f);
  }
});

// --- addKey ---

test("addKey: appends new key", () => {
  const f = fixture(`FOO=bar\n`);
  try {
    addKey(f, "BAZ", "qux");
    const keys = readEnvFile(f);
    assert.equal(keys.length, 2);
    assert.equal(keys[1]!.key, "BAZ");
    assert.equal(keys[1]!.value, "qux");
  } finally {
    cleanup(f);
  }
});

test("addKey: throws if key already exists", () => {
  const f = fixture(`FOO=bar\n`);
  try {
    assert.throws(() => addKey(f, "FOO", "other"), /already exists/);
  } finally {
    cleanup(f);
  }
});

// --- updateKey ---

test("updateKey: changes value of existing key", () => {
  const f = fixture(`FOO=bar\nBAZ=qux\n`);
  try {
    updateKey(f, "FOO", "newval");
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.value, "newval");
    assert.equal(keys[1]!.value, "qux");
  } finally {
    cleanup(f);
  }
});

test("updateKey: preserves comment above updated key", () => {
  const original = `# keep this\nFOO=bar\n`;
  const f = fixture(original);
  try {
    updateKey(f, "FOO", "new");
    assert.ok(read(f).startsWith("# keep this\n"));
  } finally {
    cleanup(f);
  }
});

test("updateKey: throws if key not found", () => {
  const f = fixture(`FOO=bar\n`);
  try {
    assert.throws(() => updateKey(f, "MISSING", "val"), /not found/);
  } finally {
    cleanup(f);
  }
});

test("updateKey: handles multiline value update", () => {
  const f = fixture(`KEY=simple\n`);
  try {
    updateKey(f, "KEY", "line one\nline two");
    const keys = readEnvFile(f);
    assert.equal(keys[0]!.value, "line one\nline two");
  } finally {
    cleanup(f);
  }
});

// --- removeKey ---

test("removeKey: removes key and its comment", () => {
  const f = fixture(`# comment\nFOO=bar\nBAZ=qux\n`);
  try {
    removeKey(f, "FOO");
    const keys = readEnvFile(f);
    assert.equal(keys.length, 1);
    assert.equal(keys[0]!.key, "BAZ");
  } finally {
    cleanup(f);
  }
});

test("removeKey: removing nonexistent key leaves file unchanged", () => {
  const original = `FOO=bar\n`;
  const f = fixture(original);
  try {
    removeKey(f, "MISSING");
    assert.equal(read(f), original);
  } finally {
    cleanup(f);
  }
});
