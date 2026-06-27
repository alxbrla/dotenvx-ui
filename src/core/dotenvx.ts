import { createRequire } from "node:module";

// @dotenvx/dotenvx ships runtime exports (keypair, logLevel options) that are
// missing from its type declarations — cast the whole import to avoid per-call
// type assertions throughout this file.
// biome-ignore lint/suspicious/noExplicitAny: dotenvx has no usable type declarations
const dotenvx: any = createRequire(import.meta.url)("@dotenvx/dotenvx");

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isEncryptedValue, readEnvFile, updateKey } from "./parser/index.js";
import type { EnvFile } from "./types.js";

export { isEncryptedValue };

export function getPrivateKey(envFile: EnvFile): string | null {
  const fromEnv = process.env.DOTENV_PRIVATE_KEY ?? null;
  if (fromEnv) return fromEnv;

  const keysFile = findKeysFile(envFile.path);
  if (!keysFile) return null;

  try {
    const keypairs = dotenvx.keypair(
      envFile.path,
      undefined,
      keysFile,
    ) as Record<string, string | null>;
    return keypairs.DOTENV_PRIVATE_KEY ?? null;
  } catch {
    return null;
  }
}

export function getPublicKey(envFile: EnvFile): string | null {
  try {
    const keypairs = dotenvx.keypair(envFile.path) as Record<
      string,
      string | null
    >;
    return keypairs.DOTENV_PUBLIC_KEY ?? null;
  } catch {
    return null;
  }
}

// Decrypt a single encrypted value. Finds which key holds this value in the
// file, then asks dotenvx to decrypt it by key name.
export function decryptValue(
  encryptedValue: string,
  envFilePath: string,
): string | null {
  if (!isEncryptedValue(encryptedValue)) return encryptedValue;

  const keyName = findKeyForValue(encryptedValue, envFilePath);
  if (!keyName) return null;

  const keysFile = findKeysFile(envFilePath);
  return silenced(() => {
    const result = dotenvx.get(keyName, {
      path: envFilePath,
      ...(keysFile ? { envKeysFile: keysFile } : {}),
      logLevel: "error",
    }) as string | undefined;
    return result ?? null;
  });
}

// Decrypts every encrypted value in the file in a single parse pass.
// Returns key → plaintext; keys that could not be decrypted (no private key)
// keep their encrypted value, so callers can detect them via isEncryptedValue.
// Use this instead of calling decryptValue in a loop — decryptValue re-parses
// the whole file per call, which is O(n²) on large files.
export function decryptAllValues(envFilePath: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(envFilePath, "utf8");
  } catch {
    return {};
  }

  let privateKey = process.env.DOTENV_PRIVATE_KEY ?? null;
  if (!privateKey) {
    const keysFile = findKeysFile(envFilePath);
    if (keysFile) {
      try {
        const keypairs = dotenvx.keypair(
          envFilePath,
          undefined,
          keysFile,
        ) as Record<string, string | null>;
        for (const [name, value] of Object.entries(keypairs)) {
          if (name.startsWith("DOTENV_PRIVATE_KEY") && value) {
            privateKey = value;
            break;
          }
        }
      } catch {
        // no usable keypair — parse below returns encrypted values as-is
      }
    }
  }

  return silenced(() => {
    try {
      return dotenvx.parse(raw, {
        ...(privateKey ? { privateKey } : {}),
        processEnv: {},
      }) as Record<string, string>;
    } catch {
      return {};
    }
  });
}

// Encrypts every plain-text key in the file using dotenvx set().
// dotenvx generates a keypair automatically on first encrypt and writes
// the private key to .env.keys next to the file.
const DOTENVX_INTERNAL_KEYS = new Set([
  "DOTENV_PUBLIC_KEY",
  "DOTENV_PRIVATE_KEY",
]);

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

// Encrypts a single key value in the file.
export function encryptKey(
  envFilePath: string,
  keyName: string,
  plainValue: string,
): void {
  dotenvx.set(keyName, plainValue, {
    path: envFilePath,
    encrypt: true,
    logLevel: "error",
  });
}

// Decrypts every encrypted key in the file back to plain text.
export function decryptFile(envFilePath: string): void {
  const keys = readEnvFile(envFilePath);
  const decrypted = decryptAllValues(envFilePath);
  for (const k of keys) {
    if (isEncryptedValue(k.value)) {
      const plain = decrypted[k.key];
      if (plain !== undefined && !isEncryptedValue(plain))
        updateKey(envFilePath, k.key, plain);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Suppress dotenvx's unconditional stderr/stdout diagnostic output (e.g.
// ☠ [MISSING_PRIVATE_KEY]) for the duration of fn, then restore streams.
function silenced<T>(fn: () => T): T {
  const origWrite = process.stderr.write.bind(process.stderr);
  const origOut = process.stdout.write.bind(process.stdout);
  // Only suppress dotenvx-style diagnostic lines
  const mute = (chunk: unknown) => {
    const s = String(chunk);
    if (
      s.includes("[MISSING_PRIVATE_KEY]") ||
      s.includes("could not decrypt") ||
      s.includes("☠")
    )
      return true;
    return false;
  };
  process.stderr.write = ((chunk: unknown, ...args: unknown[]) =>
    mute(chunk)
      ? true
      : (origWrite as (...a: unknown[]) => boolean)(
          chunk,
          ...args,
        )) as typeof process.stderr.write;
  process.stdout.write = ((chunk: unknown, ...args: unknown[]) =>
    mute(chunk)
      ? true
      : (origOut as (...a: unknown[]) => boolean)(
          chunk,
          ...args,
        )) as typeof process.stdout.write;
  try {
    return fn();
  } finally {
    process.stderr.write = origWrite;
    process.stdout.write = origOut;
  }
}

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
function findKeyForValue(
  encryptedValue: string,
  envFilePath: string,
): string | null {
  let raw: string;
  try {
    raw = readFileSync(envFilePath, "utf8");
  } catch {
    return null;
  }
  for (const line of raw.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const keyName = line.slice(0, eqIdx).trim();
    const rawVal = line.slice(eqIdx + 1).trim();
    // strip surrounding double-quotes (dotenvx stores encrypted values quoted)
    const unquoted =
      rawVal.startsWith('"') && rawVal.endsWith('"')
        ? rawVal.slice(1, -1)
        : rawVal;
    if (unquoted === encryptedValue || rawVal === encryptedValue)
      return keyName;
  }
  return null;
}
