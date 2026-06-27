import { useStdout } from "ink";
import { useEffect, useState } from "react";

// Tracks the terminal height (in rows), updating on resize.
export function useTerminalRows(): number {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout?.rows ?? 24);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setRows(stdout.rows);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return rows;
}

// Tracks the terminal width (in columns), updating on resize.
export function useTerminalCols(): number {
  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout?.columns ?? 80);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setCols(stdout.columns);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return cols;
}

// Computes the slice of a list to render so `selectedIndex` stays visible
// inside a viewport of `maxVisible` rows.
export function scrollWindow(
  length: number,
  selectedIndex: number,
  maxVisible: number,
): {
  start: number;
  end: number;
  above: number;
  below: number;
} {
  if (length <= maxVisible)
    return { start: 0, end: length, above: 0, below: 0 };
  const start = Math.min(
    Math.max(0, selectedIndex - Math.floor(maxVisible / 2)),
    length - maxVisible,
  );
  const end = start + maxVisible;
  return { start, end, above: start, below: length - end };
}
