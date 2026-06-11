import React from "react";
import { Box, Text, useInput, useStdin } from "ink";
import type { EnvFile } from "../core/types.js";

type Props = {
  files: EnvFile[];
  selectedIndex: number;
  focused: boolean;
  onSelect: (index: number) => void;
};

export function FileList({ files, selectedIndex, focused, onSelect }: Props) {
  const { isRawModeSupported } = useStdin();
  useInput((_, key) => {
    if (!focused) return;
    if (key.upArrow) onSelect(Math.max(0, selectedIndex - 1));
    if (key.downArrow) onSelect(Math.min(files.length - 1, selectedIndex + 1));
  }, { isActive: isRawModeSupported });

  const byPkg = Map.groupBy(files, (f) => f.package);

  return (
    <Box flexDirection="column" width={24} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
      {Array.from(byPkg.entries()).map(([pkg, pkgFiles]) => (
        <Box key={pkg} flexDirection="column">
          <Text bold dimColor> {pkg}</Text>
          {pkgFiles.map((f) => {
            const idx = files.indexOf(f);
            const selected = idx === selectedIndex;
            return (
              <Box key={f.path} paddingLeft={2}>
                <Text
                  backgroundColor={selected && focused ? "blue" : undefined}
                  color={selected && focused ? "white" : selected ? "cyan" : undefined}
                >
                  {f.encrypted ? "🔒 " : "   "}
                  {f.environment}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
