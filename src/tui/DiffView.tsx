import React, { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { readEnvFile } from "../core/parser/index.js";
import { decryptValue } from "../core/dotenvx.js";
import type { EnvFile, EnvKey } from "../core/types.js";

type Props = {
  left: EnvFile;
  files: EnvFile[];
  onClose: () => void;
};

type RowStatus = "left-only" | "right-only" | "same" | "diff";

type DiffRow = {
  key: string;
  leftDisplay: string;
  rightDisplay: string;
  status: RowStatus;
};

const COL_VAL = 26;

function buildDisplayMap(keys: EnvKey[], filePath: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const k of keys) {
    if (k.encrypted) {
      const plain = decryptValue(k.value, filePath);
      out.set(k.key, plain !== null ? plain : "🔒");
    } else {
      out.set(k.key, k.value);
    }
  }
  return out;
}

function buildRows(leftMap: Map<string, string>, rightMap: Map<string, string>): DiffRow[] {
  const allKeys = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()]));
  return allKeys.map((key) => {
    const l = leftMap.get(key) ?? null;
    const r = rightMap.get(key) ?? null;
    let status: RowStatus;
    if (l === null) status = "right-only";
    else if (r === null) status = "left-only";
    else if (l === r) status = "same";
    else status = "diff";
    return {
      key,
      leftDisplay: l !== null ? trunc(l, COL_VAL) : "",
      rightDisplay: r !== null ? trunc(r, COL_VAL) : "",
      status,
    };
  });
}

function trunc(s: string, max: number): string {
  const first = s.split("\n")[0]!;
  return first.length > max ? first.slice(0, max - 1) + "…" : first;
}

function safeRead(file: EnvFile): EnvKey[] {
  try { return readEnvFile(file.path); } catch { return []; }
}

export function DiffView({ left, files, onClose }: Props) {
  const { isRawModeSupported } = useStdin();
  const others = files.filter((f) => f.path !== left.path);

  const [pickerIndex, setPickerIndex] = useState(0);

  const rightFile = others[pickerIndex] ?? null;

  const leftKeys = safeRead(left);
  const rightKeys = rightFile ? safeRead(rightFile) : [];
  const leftMap = buildDisplayMap(leftKeys, left.path);
  const rightMap = rightFile ? buildDisplayMap(rightKeys, rightFile.path) : new Map<string, string>();
  const rows = rightFile ? buildRows(leftMap, rightMap) : [];
  useInput((input, key) => {
    if (key.escape || input === "q") { onClose(); return; }
    if (key.upArrow) setPickerIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setPickerIndex((i) => Math.min(others.length - 1, i + 1));
  }, { isActive: isRawModeSupported });

  const leftName = trunc(left.relativePath, COL_VAL);
  const rightName = rightFile ? trunc(rightFile.relativePath, COL_VAL) : "—";

  return (
    <Box flexDirection="column">

      {/* Header */}
      <Box paddingX={1}>
        <Text bold color="cyan">dotenvx-ui  </Text>
        <Text dimColor>diff  {left.relativePath}  ↔  {rightFile?.relativePath ?? "—"}</Text>
      </Box>

      {/* File picker */}
      <Box flexDirection="column" paddingX={1}
        borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false}>
        <Text bold dimColor>compare with</Text>
        {others.map((f, i) => {
          const selected = i === pickerIndex;
          return (
            <Box key={f.path}>
              <Text
                backgroundColor={selected ? "blue" : undefined}
                color={selected ? "white" : undefined}
              >
                {selected ? "▶ " : "  "}{f.relativePath}
              </Text>
            </Box>
          );
        })}
        {others.length === 0 && <Text dimColor>  no other files</Text>}
      </Box>

      {/* Diff table */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {/* Column headers */}
        <Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false}>
          <Text bold color="cyan">{"KEY".padEnd(22)}</Text>
          <Text bold>{"  "}{leftName.padEnd(COL_VAL + 2)}</Text>
          <Text bold>{rightName}</Text>
        </Box>
        {/* Rows */}
        {rows.map((row) => <DiffRow key={row.key} row={row} />)}
        {rows.length === 0 && (
          <Box marginTop={1}><Text dimColor>Select a file to compare.</Text></Box>
        )}
      </Box>

      {/* Status bar */}
      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
        <Text dimColor>↑↓ pick file  esc close    </Text>
        <Text color="green">● same</Text>
      </Box>

    </Box>
  );
}

function DiffRow({ row }: { row: DiffRow }) {
  const { key, leftDisplay, rightDisplay, status } = row;
  const color = status === "same" ? "green" : undefined;
  return (
    <Box>
      <Text color={color}>{key.padEnd(22)}</Text>
      <Text color={color}>{"  "}{(leftDisplay || "—").padEnd(COL_VAL + 2)}</Text>
      <Text color={color}>{rightDisplay || "—"}</Text>
    </Box>
  );
}
