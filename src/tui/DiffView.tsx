import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { readEnvFile } from "../core/parser/index.js";
import { decryptAllValues, isEncryptedValue } from "../core/dotenvx.js";
import { useTerminalRows, scrollWindow } from "./useTerminalRows.js";
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
const PICKER_MAX = 5;

function buildDisplayMap(keys: EnvKey[], filePath: string): Map<string, string> {
  // Single-pass decryption — decryptValue per key re-parses the whole file
  // each call and locks up the terminal on large files.
  const decrypted = keys.some((k) => k.encrypted) ? decryptAllValues(filePath) : {};
  const out = new Map<string, string>();
  for (const k of keys) {
    if (k.encrypted) {
      const plain = decrypted[k.key];
      out.set(k.key, plain !== undefined && !isEncryptedValue(plain) ? plain : "🔒");
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
  const termRows = useTerminalRows();
  const others = files.filter((f) => f.path !== left.path);

  const [pickerIndex, setPickerIndex] = useState(0);
  const [rowScroll, setRowScroll] = useState(0);

  const rightFile = others[pickerIndex] ?? null;

  // Cache of built display maps; populated lazily so opening diff is instant.
  const mapsCache = useRef(new Map<string, Map<string, string>>());
  const [cacheVersion, setCacheVersion] = useState(0);

  function getMap(file: EnvFile): Map<string, string> | null {
    return mapsCache.current.get(file.path) ?? null;
  }

  function buildAndCache(file: EnvFile) {
    if (!mapsCache.current.has(file.path)) {
      mapsCache.current.set(file.path, buildDisplayMap(safeRead(file), file.path));
      setCacheVersion((v) => v + 1);
    }
  }

  // Build left + first right on mount so the initial view is populated.
  useEffect(() => {
    buildAndCache(left);
    if (others[0]) buildAndCache(others[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-build neighbors while idle so navigation feels instant.
  useEffect(() => {
    const next = others[pickerIndex + 1];
    const prev = others[pickerIndex - 1];
    if (next) buildAndCache(next);
    if (prev) buildAndCache(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIndex]);

  const rows = useMemo(() => {
    if (!rightFile) return [];
    const leftMap = getMap(left);
    const rightMap = getMap(rightFile);
    if (!leftMap || !rightMap) return [];
    return buildRows(leftMap, rightMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left.path, rightFile?.path, cacheVersion]);

  // Picker viewport
  const pickerVisible = Math.min(others.length, PICKER_MAX);
  const picker = scrollWindow(others.length, pickerIndex, PICKER_MAX);

  // Rows around the diff table: header, picker header + items + border,
  // column header + border, status bar, and the scroll indicators.
  const chrome = 9 + pickerVisible + (picker.above > 0 || picker.below > 0 ? 2 : 0);
  const maxRows = Math.max(3, termRows - chrome);
  const maxScroll = Math.max(0, rows.length - maxRows);
  const scroll = Math.min(rowScroll, maxScroll);
  const visibleRows = rows.slice(scroll, scroll + maxRows);
  const rowsAbove = scroll;
  const rowsBelow = rows.length - (scroll + visibleRows.length);

  useInput((input, key) => {
    if (key.escape || input === "q") { onClose(); return; }
    if (key.upArrow) { setPickerIndex((i) => Math.max(0, i - 1)); setRowScroll(0); return; }
    if (key.downArrow) { setPickerIndex((i) => Math.min(others.length - 1, i + 1)); setRowScroll(0); return; }
    if (input === "k") setRowScroll(Math.max(0, scroll - 1));
    if (input === "j") setRowScroll(Math.min(maxScroll, scroll + 1));
    if (key.pageUp) setRowScroll(Math.max(0, scroll - maxRows));
    if (key.pageDown) setRowScroll(Math.min(maxScroll, scroll + maxRows));
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
        {picker.above > 0 && <Text dimColor>  ↑ {picker.above} more</Text>}
        {others.slice(picker.start, picker.end).map((f, i) => {
          const selected = picker.start + i === pickerIndex;
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
        {picker.below > 0 && <Text dimColor>  ↓ {picker.below} more</Text>}
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
        {rowsAbove > 0 && <Text dimColor>↑ {rowsAbove} more</Text>}
        {visibleRows.map((row) => <DiffRow key={row.key} row={row} />)}
        {rowsBelow > 0 && <Text dimColor>↓ {rowsBelow} more</Text>}
        {rows.length === 0 && (
          <Box marginTop={1}><Text dimColor>Select a file to compare.</Text></Box>
        )}
      </Box>

      {/* Status bar */}
      <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
        <Text dimColor>↑↓ pick file  j/k scroll  esc close    </Text>
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
