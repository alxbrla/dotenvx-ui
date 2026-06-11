import React from "react";
import { Box, Text, useInput, useStdin } from "ink";
import type { EnvFile, EnvKey } from "../core/types.js";

type Props = {
  file: EnvFile;
  keys: EnvKey[];
  selectedIndex: number;
  focused: boolean;
  revealed: Map<string, string>;
  onSelect: (index: number) => void;
};

const SECRET_PATTERN = /secret|password|token|key|private|api_?key/i;

function maskValue(k: EnvKey, revealed: Map<string, string>): string {
  if (revealed.has(k.key)) return revealed.get(k.key)!;
  if (k.encrypted) return "••••••••••••••";
  if (SECRET_PATTERN.test(k.key)) return "••••••••";
  return k.value.length > 48 ? k.value.slice(0, 48) + "…" : k.value;
}

export function KeyTable({ file, keys, selectedIndex, focused, revealed, onSelect }: Props) {
  const { isRawModeSupported } = useStdin();
  useInput((_, key) => {
    if (!focused) return;
    if (key.upArrow) onSelect(Math.max(0, selectedIndex - 1));
    if (key.downArrow) onSelect(Math.min(keys.length - 1, selectedIndex + 1));
  }, { isActive: isRawModeSupported });

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
        keys.map((k, idx) => {
          const selected = idx === selectedIndex;
          const value = maskValue(k, revealed);
          const lockIcon = k.encrypted && !revealed.has(k.key) ? " 🔒" : "";
          return (
            <Box key={k.key} paddingX={1}>
              <Text
                backgroundColor={selected && focused ? "blue" : undefined}
                color={selected && focused ? "white" : selected ? "cyan" : undefined}
              >
                {k.key.padEnd(24)}
                <Text dimColor={!selected}>{value}</Text>
                {lockIcon}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
