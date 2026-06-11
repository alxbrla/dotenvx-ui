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

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (key.return) { onSubmit(value); return; }
    if (key.backspace || key.delete) { setValue((v) => v.slice(0, -1)); return; }
    if (input && !key.ctrl && !key.meta) setValue((v) => v + input);
  }, { isActive: isRawModeSupported });

  return (
    <Box paddingX={1}>
      <Text bold>{label}: </Text>
      <Text>{value}</Text>
      <Text inverse> </Text>
      <Text dimColor>  enter confirm  esc cancel</Text>
    </Box>
  );
}
