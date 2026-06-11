import React, { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";

type Props = {
  label: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function InlineForm({ label, initialValue = "", onSubmit, onCancel }: Props) {
  const { isRawModeSupported } = useStdin();
  const [value, setValue] = useState(initialValue);
  const [cursor, setCursor] = useState(initialValue.length);

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) { onSubmit(value); return; }

    if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor((c) => Math.min(value.length, c + 1));
      return;
    }
    // Ctrl+A / Home
    if ((key.ctrl && input === "a") || key.home) {
      setCursor(0);
      return;
    }
    // Ctrl+E / End
    if ((key.ctrl && input === "e") || key.end) {
      setCursor(value.length);
      return;
    }
    // Ctrl+K — delete to end of line
    if (key.ctrl && input === "k") {
      setValue((v) => v.slice(0, cursor));
      return;
    }
    // Ctrl+U — delete to start of line
    if (key.ctrl && input === "u") {
      setValue((v) => v.slice(cursor));
      setCursor(0);
      return;
    }
    // Backspace — delete char before cursor
    if (key.backspace) {
      if (cursor === 0) return;
      setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
      setCursor((c) => c - 1);
      return;
    }
    // Delete (forward) — delete char after cursor
    if (key.delete) {
      setValue((v) => v.slice(0, cursor) + v.slice(cursor + 1));
      return;
    }
    // Printable character — insert at cursor
    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v.slice(0, cursor) + input + v.slice(cursor));
      setCursor((c) => c + input.length);
    }
  }, { isActive: isRawModeSupported });

  const before = value.slice(0, cursor);
  const at = value[cursor] ?? " ";
  const after = value.slice(cursor + 1);

  return (
    <Box flexDirection="column" borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} paddingTop={0}>
      <Box>
        <Text bold color="cyan">{label} </Text>
        <Text>{before}</Text>
        <Text inverse>{at}</Text>
        <Text>{after}</Text>
        <Text dimColor>   ↵ confirm  esc cancel</Text>
      </Box>
    </Box>
  );
}
