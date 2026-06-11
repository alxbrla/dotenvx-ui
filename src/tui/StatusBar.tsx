import React from "react";
import { Box, Text } from "ink";

type Props = {
  message?: string;
  focus: "files" | "keys";
};

const FILE_HINTS = "↑↓ navigate  tab switch panel  q quit";
const KEY_HINTS  = "↑↓ navigate  tab switch panel  y copy  r reveal  a add  D delete  d diff  q quit";

export function StatusBar({ message, focus }: Props) {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>{message ?? (focus === "files" ? FILE_HINTS : KEY_HINTS)}</Text>
    </Box>
  );
}
