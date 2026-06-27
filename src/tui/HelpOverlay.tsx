import { Box, Text, useInput, useStdin } from "ink";

type Props = { onClose: () => void };

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "Navigation",
    rows: [
      ["↑ ↓", "Move up / down"],
      ["Tab", "Switch between file list and key table"],
      ["q / Esc", "Quit"],
    ],
  },
  {
    title: "Key actions",
    rows: [
      ["Enter", "Edit selected key"],
      ["a", "Add new key"],
      ["D", "Delete selected key (confirmation required)"],
      ["y", "Copy value to clipboard"],
      ["r", "Reveal / hide selected key value"],
      ["R", "Reveal / hide all key values"],
    ],
  },
  {
    title: "File actions",
    rows: [
      ["e", "Encrypt / decrypt entire file"],
      ["d", "Open diff view"],
    ],
  },
  {
    title: "Diff view",
    rows: [
      ["↑ ↓", "Pick file to compare"],
      ["Esc / q", "Close diff view"],
    ],
  },
];

const KEY_WIDTH = 10;

export function HelpOverlay({ onClose }: Props) {
  const { isRawModeSupported } = useStdin();
  useInput(
    (input, key) => {
      if (input === "?" || input === "q" || key.escape) onClose();
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          dotenvx-ui{" "}
        </Text>
        <Text dimColor>keyboard shortcuts</Text>
      </Box>
      {SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold>{section.title}</Text>
          {section.rows.map(([key, desc]) => (
            <Box key={key}>
              <Text color="cyan">{key.padEnd(KEY_WIDTH)}</Text>
              <Text dimColor>{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>? / q / esc close help</Text>
      </Box>
    </Box>
  );
}
