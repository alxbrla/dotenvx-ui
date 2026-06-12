import React from "react";
import { Box, Text } from "ink";

type Props = {
  message?: string;
  focus: "files" | "keys";
};

type Hint = { key: string; action: string };

const FILE_HINTS: Hint[] = [
  { key: "↑↓", action: "navigate" },
  { key: "tab", action: "switch panel" },
  { key: "?", action: "help" },
  { key: "q", action: "quit" },
];

const KEY_HINTS: Hint[] = [
  { key: "↑↓", action: "navigate" },
  { key: "tab", action: "switch" },
  { key: "enter", action: "edit" },
  { key: "y", action: "copy" },
  { key: "r", action: "reveal" },
  { key: "a", action: "add" },
  { key: "D", action: "delete" },
  { key: "d", action: "diff" },
  { key: "?", action: "help" },
  { key: "q", action: "quit" },
];

function Hints({ hints }: { hints: Hint[] }) {
  return (
    <Box gap={2}>
      {hints.map(({ key, action }) => (
        <Box key={key} gap={1}>
          <Text bold color="cyan">{key}</Text>
          <Text dimColor>{action}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function StatusBar({ message, focus }: Props) {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      {message
        ? <Text>{message}</Text>
        : <Hints hints={focus === "files" ? FILE_HINTS : KEY_HINTS} />
      }
    </Box>
  );
}
