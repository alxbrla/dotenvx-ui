import React, { useState, useRef } from "react";
import { Box, Text, useInput, useStdin, useStdout } from "ink";

type Props = {
  label: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

type EditorState = {
  lines: string[];
  row: number;
  col: number;
};

function makeInitialState(value: string): EditorState {
  const lines = value.split("\n");
  return {
    lines,
    row: lines.length - 1,
    col: lines[lines.length - 1]!.length,
  };
}

// outer Layout paddingX={1} (2) + InlineForm paddingX={1} (2) + 1 indent space = 5
const CHROME = 5;

export function InlineForm({ label, initialValue = "", onSubmit, onCancel }: Props) {
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  const [editor, setEditor] = useState<EditorState>(() => makeInitialState(initialValue));
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }

    const { lines, row, col } = editorRef.current;
    const lineWidth = Math.max(1, (stdout?.columns ?? 80) - CHROME);

    if (key.return) {
      onSubmit(lines.join("\n"));
      return;
    }

    if (key.upArrow) {
      const line = lines[row]!;
      const visualRow = Math.floor(col / lineWidth);
      if (visualRow > 0) {
        // Move up one visual row within the same logical line
        const targetVisualRow = visualRow - 1;
        const colInVisualRow = col % lineWidth;
        const newCol = Math.min(targetVisualRow * lineWidth + colInVisualRow, line.length);
        setEditor({ lines, row, col: newCol });
      } else if (row > 0) {
        // Move to the previous logical line, last visual row
        const prevLine = lines[row - 1]!;
        const prevVisualRows = Math.floor(prevLine.length / lineWidth);
        const colInVisualRow = col % lineWidth;
        const newCol = Math.min(prevVisualRows * lineWidth + colInVisualRow, prevLine.length);
        setEditor({ lines, row: row - 1, col: newCol });
      }
      return;
    }

    if (key.downArrow) {
      const line = lines[row]!;
      const visualRow = Math.floor(col / lineWidth);
      const lastVisualRow = Math.floor(line.length / lineWidth);
      if (visualRow < lastVisualRow) {
        // Move down one visual row within the same logical line
        const colInVisualRow = col % lineWidth;
        const newCol = Math.min((visualRow + 1) * lineWidth + colInVisualRow, line.length);
        setEditor({ lines, row, col: newCol });
      } else if (row < lines.length - 1) {
        // Move to the next logical line
        const colInVisualRow = col % lineWidth;
        const newCol = Math.min(colInVisualRow, lines[row + 1]!.length);
        setEditor({ lines, row: row + 1, col: newCol });
      }
      return;
    }

    if (key.leftArrow) {
      if (col > 0) {
        setEditor({ lines, row, col: col - 1 });
      } else if (row > 0) {
        const newRow = row - 1;
        setEditor({ lines, row: newRow, col: lines[newRow]!.length });
      }
      return;
    }

    if (key.rightArrow) {
      if (col < lines[row]!.length) {
        setEditor({ lines, row, col: col + 1 });
      } else if (row < lines.length - 1) {
        setEditor({ lines, row: row + 1, col: 0 });
      }
      return;
    }

    if ((key.ctrl && input === "a") || key.home) {
      setEditor({ lines, row, col: 0 });
      return;
    }

    if ((key.ctrl && input === "e") || key.end) {
      setEditor({ lines, row, col: lines[row]!.length });
      return;
    }

    if (key.ctrl && input === "k") {
      const newLines = lines.map((l, i) => i === row ? l.slice(0, col) : l);
      setEditor({ lines: newLines, row, col });
      return;
    }

    if (key.ctrl && input === "u") {
      const newLines = lines.map((l, i) => i === row ? l.slice(col) : l);
      setEditor({ lines: newLines, row, col: 0 });
      return;
    }

    if (key.backspace) {
      if (col > 0) {
        const cur = lines[row]!;
        const newLines = lines.map((l, i) => i === row ? cur.slice(0, col - 1) + cur.slice(col) : l);
        setEditor({ lines: newLines, row, col: col - 1 });
      } else if (row > 0) {
        const prevLen = lines[row - 1]!.length;
        const merged = lines[row - 1]! + lines[row]!;
        const newLines = [...lines.slice(0, row - 1), merged, ...lines.slice(row + 1)];
        setEditor({ lines: newLines, row: row - 1, col: prevLen });
      }
      return;
    }

    if (key.delete) {
      const cur = lines[row]!;
      if (col < cur.length) {
        const newLines = lines.map((l, i) => i === row ? cur.slice(0, col) + cur.slice(col + 1) : l);
        setEditor({ lines: newLines, row, col });
      } else if (row < lines.length - 1) {
        const merged = cur + lines[row + 1]!;
        const newLines = [...lines.slice(0, row), merged, ...lines.slice(row + 2)];
        setEditor({ lines: newLines, row, col });
      }
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      const cur = lines[row]!;
      const newLines = lines.map((l, i) => i === row ? cur.slice(0, col) + input + cur.slice(col) : l);
      setEditor({ lines: newLines, row, col: col + input.length });
    }
  }, { isActive: isRawModeSupported });

  const { lines, row, col } = editor;

  return (
    <Box flexDirection="column" borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} paddingTop={0}>
      <Box>
        <Text bold color="cyan">{label} </Text>
        <Text dimColor>↵ confirm  esc cancel</Text>
      </Box>
      {lines.map((line, r) => {
        const isActive = r === row;
        if (!isActive) {
          return (
            <Box key={r}>
              <Text dimColor> </Text>
              <Text>{line || " "}</Text>
            </Box>
          );
        }
        const before = line.slice(0, col);
        const cursor = line[col] ?? " ";
        const after = line.slice(col + 1);
        return (
          <Box key={r}>
            <Text dimColor> </Text>
            <Text>{before}<Text inverse>{cursor}</Text>{after}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
