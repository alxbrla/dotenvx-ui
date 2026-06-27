import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EnvKey } from "../types.js";
import { isEncryptedValue, parseValue, serializeKeyValue } from "./values.js";

type RawLine = { type: "raw"; text: string };
type RawKey = { type: "key"; key: string; value: string; lines: string[] };
type Entry = RawLine | RawKey;

export function readEnvFile(filePath: string): EnvKey[] {
  const content = readFileSync(filePath, "utf8");
  return parse(content)
    .filter((e): e is RawKey => e.type === "key")
    .map((e) => ({
      key: e.key,
      value: e.value,
      encrypted: isEncryptedValue(e.value),
      comment: extractLeadingComment(e.lines),
    }));
}

export function writeEnvFile(filePath: string, keys: EnvKey[]): void {
  const content = readFileSync(filePath, "utf8");
  const entries = parse(content);
  const updates = new Map(keys.map((k) => [k.key, k]));
  const outLines: string[] = [];
  const written = new Set<string>();

  for (const entry of entries) {
    if (entry.type === "raw") {
      outLines.push(entry.text);
      continue;
    }
    const update = updates.get(entry.key);
    if (!update) continue; // key was removed

    written.add(entry.key);
    const leadingComments = getLeadingCommentLines(entry.lines);
    outLines.push(...leadingComments);

    if (update.value === entry.value) {
      // Value unchanged — emit the original raw line to preserve quoting/formatting
      const keyLines = entry.lines.filter(
        (l) => !l.trimStart().startsWith("#"),
      );
      outLines.push(...keyLines);
    } else {
      outLines.push(serializeKeyValue(entry.key, update.value));
    }
  }

  // Append keys not present in the original file
  for (const k of keys) {
    if (!written.has(k.key)) {
      if (k.comment) outLines.push(`# ${k.comment}`);
      outLines.push(serializeKeyValue(k.key, k.value));
    }
  }

  const output = outLines.join("\n") + (content.endsWith("\n") ? "\n" : "");
  atomicWrite(filePath, output);
}

export function addKey(filePath: string, key: string, value: string): void {
  const keys = readEnvFile(filePath);
  if (keys.some((k) => k.key === key)) {
    throw new Error(`Key "${key}" already exists in ${filePath}`);
  }
  keys.push({ key, value, encrypted: isEncryptedValue(value) });
  writeEnvFile(filePath, keys);
}

export function updateKey(filePath: string, key: string, value: string): void {
  const keys = readEnvFile(filePath);
  const idx = keys.findIndex((k) => k.key === key);
  if (idx === -1) throw new Error(`Key "${key}" not found in ${filePath}`);
  keys[idx] = { ...keys[idx]!, key, value, encrypted: isEncryptedValue(value) };
  writeEnvFile(filePath, keys);
}

export function removeKey(filePath: string, key: string): void {
  const keys = readEnvFile(filePath).filter((k) => k.key !== key);
  writeEnvFile(filePath, keys);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function parse(content: string): Entry[] {
  const entries: Entry[] = [];
  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  let i = 0;
  let pendingComments: string[] = [];

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      for (const c of pendingComments) entries.push({ type: "raw", text: c });
      pendingComments = [];
      entries.push({ type: "raw", text: line });
      i++;
      continue;
    }

    if (line.trimStart().startsWith("#")) {
      pendingComments.push(line);
      i++;
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      for (const c of pendingComments) entries.push({ type: "raw", text: c });
      pendingComments = [];
      entries.push({ type: "raw", text: line });
      i++;
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const rawValue = line.slice(eqIdx + 1);
    const { value, extraLines } = parseValue(rawValue, lines, i + 1);

    entries.push({
      type: "key",
      key,
      value,
      lines: [...pendingComments, line, ...extraLines],
    });
    pendingComments = [];
    i += 1 + extraLines.length;
  }

  for (const c of pendingComments) entries.push({ type: "raw", text: c });
  return entries;
}

function getLeadingCommentLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const l of lines) {
    if (l.trimStart().startsWith("#")) result.push(l);
    else break;
  }
  return result;
}

function extractLeadingComment(lines: string[]): string | undefined {
  const comments = getLeadingCommentLines(lines).map((l) =>
    l.trimStart().slice(1).trim(),
  );
  return comments.length > 0 ? comments.join("\n") : undefined;
}

function atomicWrite(filePath: string, content: string): void {
  const tmp = join(
    dirname(filePath),
    `.dotenvx-ui-tmp-${randomBytes(6).toString("hex")}`,
  );
  try {
    writeFileSync(tmp, content, { encoding: "utf8", flag: "wx" });
    renameSync(tmp, filePath);
  } catch (err) {
    try {
      writeFileSync(tmp, "");
    } catch {}
    throw new Error(`Failed to write ${filePath}: ${(err as Error).message}`);
  }
}
