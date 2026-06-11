import React, { useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import { FileList } from "./FileList.js";
import { KeyTable } from "./KeyTable.js";
import { StatusBar } from "./StatusBar.js";
import { readEnvFile } from "../core/parser/index.js";
import type { EnvFile, EnvKey } from "../core/types.js";

type Props = {
  files: EnvFile[];
};

type Focus = "files" | "keys";

export function App({ files }: Props) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [fileIndex, setFileIndex] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const [focus, setFocus] = useState<Focus>("files");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState<string | undefined>();

  const selectedFile = files[fileIndex]!;

  let keys: EnvKey[] = [];
  try {
    keys = readEnvFile(selectedFile.path);
  } catch {}

  useInput((input, key) => {
    if (input === "q" || key.escape) { exit(); return; }
    if (key.tab) {
      setFocus((f) => f === "files" ? "keys" : "files");
      return;
    }
    // Reveal toggle on selected key
    if (input === "r" && focus === "keys") {
      const k = keys[keyIndex];
      if (!k) return;
      setRevealed((prev) => {
        const next = new Set(prev);
        next.has(k.key) ? next.delete(k.key) : next.add(k.key);
        return next;
      });
      return;
    }
    // Copy placeholder — wired in Phase 7
    if (input === "y" && focus === "keys") {
      flash("y — copy coming in Phase 7");
    }
  }, { isActive: isRawModeSupported });

  function flash(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(undefined), 1500);
  }

  // Reset key selection when file changes
  function selectFile(idx: number) {
    setFileIndex(idx);
    setKeyIndex(0);
    setRevealed(new Set());
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color="cyan">dotenvx-ui</Text>
        <Text dimColor>  {selectedFile.relativePath}  ·  {files.length} files</Text>
      </Box>

      {/* Main panels */}
      <Box flexGrow={1}>
        <FileList
          files={files}
          selectedIndex={fileIndex}
          focused={focus === "files"}
          onSelect={selectFile}
        />
        <KeyTable
          file={selectedFile}
          keys={keys}
          selectedIndex={keyIndex}
          focused={focus === "keys"}
          revealed={revealed}
          onSelect={setKeyIndex}
        />
      </Box>

      <StatusBar focus={focus} message={statusMsg} />
    </Box>
  );
}
