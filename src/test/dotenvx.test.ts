import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  decryptAllValues,
  decryptFile,
  decryptValue,
  encryptFile,
  getPrivateKey,
  getPublicKey,
  isEncryptedValue,
} from "../core/dotenvx.js";
import { readEnvFile } from "../core/parser/index.js";
import type { EnvFile } from "../core/types.js";

function fixture(content: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "dotenvx-ui-dx-"));
  const file = join(dir, ".env");
  writeFileSync(file, content);
  return { dir, file };
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function makeEnvFile(filePath: string): EnvFile {
  return {
    path: filePath,
    relativePath: ".env",
    package: ".",
    environment: "default",
    encrypted: false,
    hasPublicKey: false,
    keys: [],
  };
}

// --- isEncryptedValue ---

test("isEncryptedValue: detects encrypted: prefix", () => {
  assert.equal(isEncryptedValue("encrypted:abc123"), true);
  assert.equal(isEncryptedValue("plaintext"), false);
  assert.equal(isEncryptedValue(""), false);
});

// --- encryptFile / decryptValue / decryptFile ---

test("encryptFile: encrypts plain keys and creates .env.keys", () => {
  const { dir, file } = fixture("FOO=bar\nBAZ=qux\n");
  try {
    encryptFile(file);

    const keys = readEnvFile(file).filter((k) => k.key !== "DOTENV_PUBLIC_KEY");
    assert.ok(
      keys.every((k) => isEncryptedValue(k.value)),
      "all values should be encrypted",
    );
    assert.ok(
      existsSync(join(dir, ".env.keys")),
      ".env.keys should be created",
    );
  } finally {
    cleanup(dir);
  }
});

test("encryptFile: skips already-encrypted keys", () => {
  const { dir, file } = fixture("FOO=bar\n");
  try {
    encryptFile(file);
    const afterFirst = readEnvFile(file).find((k) => k.key === "FOO")!.value;

    encryptFile(file); // second pass — should not re-encrypt
    const afterSecond = readEnvFile(file).find((k) => k.key === "FOO")!.value;

    assert.equal(afterFirst, afterSecond);
  } finally {
    cleanup(dir);
  }
});

test("decryptValue: decrypts an encrypted value back to plaintext", () => {
  const { dir, file } = fixture("SECRET=hunter2\n");
  try {
    encryptFile(file);

    const encryptedVal = readEnvFile(file).find(
      (k) => k.key === "SECRET",
    )!.value;
    assert.ok(isEncryptedValue(encryptedVal));

    const plain = decryptValue(encryptedVal, file);
    assert.equal(plain, "hunter2");
  } finally {
    cleanup(dir);
  }
});

test("decryptValue: returns null when no private key available", () => {
  // Encrypted value from a different keypair — no .env.keys present
  const result = decryptValue(
    "encrypted:BFakeEncryptedValue==",
    "/nonexistent/.env",
  );
  assert.equal(result, null);
});

test("decryptValue: returns value as-is when not encrypted", () => {
  const result = decryptValue("plaintext", "/any/path");
  assert.equal(result, "plaintext");
});

test("decryptFile: decrypts all keys back to plaintext", () => {
  const { dir, file } = fixture("FOO=bar\nBAZ=qux\n");
  try {
    encryptFile(file);
    const encKeys = readEnvFile(file).filter(
      (k) => k.key !== "DOTENV_PUBLIC_KEY",
    );
    assert.ok(encKeys.every((k) => isEncryptedValue(k.value)));

    decryptFile(file);
    const keys = readEnvFile(file);
    const foo = keys.find((k) => k.key === "FOO");
    const baz = keys.find((k) => k.key === "BAZ");
    assert.equal(foo?.value, "bar");
    assert.equal(baz?.value, "qux");
  } finally {
    cleanup(dir);
  }
});

// --- decryptAllValues ---

test("decryptAllValues: decrypts every encrypted value in one pass", () => {
  const { dir, file } = fixture("FOO=bar\nBAZ=qux\nPLAIN=visible\n");
  try {
    encryptFile(file);

    const all = decryptAllValues(file);
    assert.equal(all.FOO, "bar");
    assert.equal(all.BAZ, "qux");
    assert.equal(all.PLAIN, "visible");
  } finally {
    cleanup(dir);
  }
});

test("decryptAllValues: keeps values encrypted when no private key available", () => {
  const { dir, file } = fixture("FOO=bar\n");
  try {
    encryptFile(file);
    rmSync(join(dir, ".env.keys"));

    const all = decryptAllValues(file);
    assert.ok(
      isEncryptedValue(all.FOO!),
      "value should stay encrypted without a key",
    );
  } finally {
    cleanup(dir);
  }
});

test("decryptAllValues: returns empty object for missing file", () => {
  assert.deepEqual(decryptAllValues("/nonexistent/.env"), {});
});

// --- getPublicKey / getPrivateKey ---

test("getPublicKey: returns public key after encryption", () => {
  const { dir, file } = fixture("FOO=bar\n");
  try {
    encryptFile(file);
    const pubKey = getPublicKey(makeEnvFile(file));
    assert.ok(pubKey !== null, "should have a public key");
    assert.ok(pubKey!.length > 0);
  } finally {
    cleanup(dir);
  }
});

test("getPrivateKey: returns private key from .env.keys", () => {
  const { dir, file } = fixture("FOO=bar\n");
  try {
    encryptFile(file);
    const privKey = getPrivateKey(makeEnvFile(file));
    assert.ok(privKey !== null, "should find private key in .env.keys");
    assert.ok(privKey!.length > 0);
  } finally {
    cleanup(dir);
  }
});

test("getPrivateKey: returns null when no .env.keys exists", () => {
  const { dir, file } = fixture("FOO=bar\n");
  try {
    const privKey = getPrivateKey(makeEnvFile(file));
    assert.equal(privKey, null);
  } finally {
    cleanup(dir);
  }
});
