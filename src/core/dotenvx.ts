import { createRequire } from "node:module";
// @dotenvx/dotenvx ships runtime exports (keypair, logLevel options) that are
// missing from its type declarations — cast the whole import to avoid per-call
// type assertions throughout this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dotenvx: any = createRequire(import.meta.url)("@dotenvx/dotenvx");
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import type { EnvFile } from "./types.js";
import { isEncryptedValue, readEnvFile, updateKey } from "./parser/index.js";

export { isEncryptedValue };

export function getPrivateKey(envFile: EnvFile): string | null {
  const fromEnv = process.env["DOTENV_PRIVATE_KEY"] ?? null;
  if (fromEnv) return fromEnv;

  const keysFile = findKeysFile(envFile.path);
  if (!keysFile) return null;

  try {
    const keypairs = dotenvx.keypair(envFile.path, undefined, keysFile) as Record<string, string | null>;
    return keypairs["DOTENV_PRIVATE_KEY"] ?? null;
  } catch {
    return null;
  }
}

export function getPublicKey(envFile: EnvFile): string | null {
  try {
    const keypairs = dotenvx.keypair(envFile.path) as Record<string, string | null>;
    return keypairs["DOTENV_PUBLIC_KEY"] ?? null;
  } catch {
    return null;
  }
}

// Decrypt a single encrypted value. Finds which key holds this value in the
// file, then asks dotenvx to decrypt it by key name.
export function decryptValue(
  encryptedValue: string,
  envFilePath: string
): string | null {
  if (!isEncryptedValue(encryptedValue)) return encryptedValue;

  const keyName = findKeyForValue(encryptedValue, envFilePath);
  if (!keyName) return null;

  const keysFile = findKeysFile(envFilePath);
  try {
    const result = dotenvx.get(keyName, {
      path: envFilePath,
      ...(keysFile ? { envKeysFile: keysFile } : {}),
      logLevel: "error",
    }) as string | undefined;
    return result ?? null;
  } catch {
    return null;
  }
}

// Encrypts every plain-text key in the file using dotenvx set().
// dotenvx generates a keypair automatically on first encrypt and writes
// the private key to .env.keys next to the file.
const DOTENVX_INTERNAL_KEYS = new Set(["DOTENV_PUBLIC_KEY", "DOTENV_PRIVATE_KEY"]);

export function encryptFile(envFilePath: string): void {
  const keys = readEnvFile(envFilePath);
  for (const k of keys) {
    if (!isEncryptedValue(k.value) && !DOTENVX_INTERNAL_KEYS.has(k.key)) {
      dotenvx.set(k.key, k.value, {
        path: envFilePath,
        encrypt: true,
        logLevel: "error",
      });
    }
  }
}

// Decrypts every encrypted key in the file back to plain text.
export function decryptFile(envFilePath: string): void {
  const keys = readEnvFile(envFilePath);
  for (const k of keys) {
    if (isEncryptedValue(k.value)) {
      const plain = decryptValue(k.value, envFilePath);
      if (plain !== null) updateKey(envFilePath, k.key, plain);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findKeysFile(envFilePath: string): string | null {
  let dir = dirname(envFilePath);
  while (true) {
    const candidate = join(dir, ".env.keys");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Scans the raw file to find which KEY name holds the given encrypted value.
function findKeyForValue(encryptedValue: string, envFilePath: string): string | null {
  let raw: string;
  try {
    raw = readFileSync(envFilePath, "utf8");
  } catch {
    return null;
  }
  for (const line of raw.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const lineValue = line.slice(eqIdx + 1).trim();
    if (lineValue === encryptedValue) return line.slice(0, eqIdx).trim();
  }
  return null;
}
