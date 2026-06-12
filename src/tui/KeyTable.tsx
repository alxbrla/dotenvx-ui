import React from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { scrollWindow } from "./useTerminalRows.js";
import type { EnvFile, EnvKey } from "../core/types.js";

type Props = {
  file: EnvFile;
  keys: EnvKey[];
  selectedIndex: number;
  focused: boolean;
  interactive: boolean;
  revealed: Map<string, string>;
  onSelect: (index: number) => void;
  maxRows: number;
};

const SECRET_PATTERN = /secret|password|token|key|private|api_?key/i;

const MAX_INLINE = 48;

function truncate(s: string): string {
  const first = s.split("\n")[0]!;
  return first.length > MAX_INLINE ? first.slice(0, MAX_INLINE - 1) + "…" : first;
}

function maskValue(k: EnvKey, revealed: Map<string, string>): string {
  if (revealed.has(k.key)) return truncate(revealed.get(k.key)!);
  if (k.encrypted) return "••••••••••••••";
  if (SECRET_PATTERN.test(k.key)) return "••••••••";
  return truncate(k.value);
}

export function KeyTable({ file, keys, selectedIndex, focused, interactive, revealed, onSelect, maxRows }: Props) {
  const { isRawModeSupported } = useStdin();
  useInput((_, key) => {
    if (!focused) return;
    if (key.upArrow) onSelect(Math.max(0, selectedIndex - 1));
    if (key.downArrow) onSelect(Math.min(keys.length - 1, selectedIndex + 1));
  }, { isActive: isRawModeSupported && interactive });

  // file header (1) + two "more" indicators (2) = 3 rows of chrome inside the list box.
  const maxVisible = Math.max(3, maxRows - 3);
  const { start, end, above, below } = scrollWindow(keys.length, selectedIndex, maxVisible);
  const visibleKeys = keys.slice(start, end);

  const keyColWidth = Math.min(48, Math.max(16, ...keys.map((k) => k.key.length))) + 2;

  const encBadge = file.encrypted
    ? <Text color="yellow"> encrypted</Text>
    : <Text dimColor> plain</Text>;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* File header */}
      <Box paddingX={1}>
        <Text bold>{file.relativePath}</Text>
        {encBadge}
        <Text dimColor>  {keys.length} key{keys.length === 1 ? "" : "s"}</Text>
      </Box>

      {/* Keys */}
      {keys.length === 0 ? (
        <Box paddingX={2} marginTop={1}>
          <Text dimColor>No keys found. Press <Text bold>a</Text> to add one.</Text>
        </Box>
      ) : (
        <>
          {above > 0 && (
            <Box paddingX={1}>
              <Text dimColor>↑ {above} more</Text>
            </Box>
          )}
          {visibleKeys.map((k, i) => {
            const idx = start + i;
            const selected = idx === selectedIndex;
            const value = maskValue(k, revealed);
            const lockIcon = k.encrypted && !revealed.has(k.key) ? " 🔒" : "";
            return (
              <Box key={k.key} paddingX={1}>
                <Text
                  backgroundColor={selected && focused ? "blue" : undefined}
                  color={selected && focused ? "white" : selected ? "cyan" : undefined}
                >
                  {k.key.padEnd(keyColWidth)}
                  <Text dimColor={!selected}>{value}</Text>
                  {lockIcon}
                </Text>
              </Box>
            );
          })}
          {below > 0 && (
            <Box paddingX={1}>
              <Text dimColor>↓ {below} more</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
