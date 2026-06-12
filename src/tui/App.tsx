import React, { useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import clipboard from "clipboardy";
import { FileList } from "./FileList.js";
import { KeyTable } from "./KeyTable.js";
import { StatusBar } from "./StatusBar.js";
import { DiffView } from "./DiffView.js";
import { HelpOverlay } from "./HelpOverlay.js";
import { InlineForm } from "./InlineForm.js";
import { readEnvFile, addKey, updateKey, removeKey } from "../core/parser/index.js";
import { decryptValue, decryptAllValues, isEncryptedValue, encryptFile, decryptFile, encryptKey } from "../core/dotenvx.js";
import { useTerminalCols, useTerminalRows } from "./useTerminalRows.js";
import type { EnvFile, EnvKey } from "../core/types.js";

type Props = { files: EnvFile[] };
type Focus = "files" | "keys";
type Mode =
  | { type: "normal" }
  | { type: "edit"; key: EnvKey }
  | { type: "add-key" }
  | { type: "add-value"; keyName: string }
  | { type: "confirm-add-encrypt"; keyName: string; value: string }
  | { type: "confirm-delete"; key: EnvKey }
  | { type: "confirm-encrypt" }
  | { type: "diff" }
  | { type: "help" };

export function App({ files }: Props) {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  const [fileIndex, setFileIndex] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const [focus, setFocus] = useState<Focus>("files");
  // Maps key name → decrypted plaintext for revealed encrypted keys.
  // Plain (non-encrypted) keys toggle in/out with a sentinel value "".
  const [revealed, setRevealed] = useState<Map<string, string>>(new Map());
  const [mode, setMode] = useState<Mode>({ type: "normal" });
  const [statusMsg, setStatusMsg] = useState<string | undefined>();
  const [keys, setKeys] = useState<EnvKey[]>(() => loadKeys(files[0]!));

  const selectedFile = files[fileIndex]!;

  function loadKeys(file: EnvFile): EnvKey[] {
    try { return readEnvFile(file.path); } catch { return []; }
  }

  function refreshKeys() {
    setKeys(loadKeys(selectedFile));
  }

  function selectFile(idx: number) {
    setFileIndex(idx);
    setKeyIndex(0);
    setRevealed(new Map());
    setKeys(loadKeys(files[idx]!));
  }

  function flash(msg: string, ms = 1500) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(undefined), ms);
  }

  useInput((input, key) => {
    if (input === "q" || key.escape) { exit(); return; }
    if (input === "?") { setMode({ type: "help" }); return; }

    if (key.tab) {
      setFocus((f) => f === "files" ? "keys" : "files");
      return;
    }

    if (focus !== "keys") return;

    const k = keys[keyIndex];

    // Reveal / hide single key
    if (input === "r") {
      if (!k) return;
      if (revealed.has(k.key)) {
        setRevealed((prev) => { const next = new Map(prev); next.delete(k.key); return next; });
        return;
      }
      if (k.encrypted) {
        const plain = decryptValue(k.value, selectedFile.path);
        if (plain === null) { flash("🔒 Private key not found in environment"); return; }
        setRevealed((prev) => new Map(prev).set(k.key, plain));
      } else {
        setRevealed((prev) => new Map(prev).set(k.key, k.value));
      }
      return;
    }

    // Reveal / hide all keys in this file
    if (input === "R") {
      if (revealed.size > 0) {
        setRevealed(new Map());
        return;
      }
      const decrypted = keys.some((e) => e.encrypted) ? decryptAllValues(selectedFile.path) : {};
      const next = new Map<string, string>();
      for (const entry of keys) {
        if (entry.encrypted) {
          const plain = decrypted[entry.key];
          if (plain === undefined || isEncryptedValue(plain)) { flash("🔒 Private key not found — cannot reveal all"); return; }
          next.set(entry.key, plain);
        } else {
          next.set(entry.key, entry.value);
        }
      }
      setRevealed(next);
      return;
    }

    // Copy
    if (input === "y") {
      if (!k) return;
      const value = k.encrypted
        ? decryptValue(k.value, selectedFile.path)
        : k.value;
      if (value === null) { flash("🔒 Private key not found — cannot copy"); return; }
      clipboard.writeSync(value);
      flash(`Copied ${k.key}`);
      return;
    }

    // Edit — for encrypted keys, pre-decrypt so the form shows plaintext
    if (key.return) {
      if (!k) return;
      if (k.encrypted) {
        const plain = decryptValue(k.value, selectedFile.path);
        if (plain === null) { flash("🔒 Private key not found — cannot edit"); return; }
        setMode({ type: "edit", key: { ...k, value: plain } });
      } else {
        setMode({ type: "edit", key: k });
      }
      return;
    }

    // Add
    if (input === "a") {
      setMode({ type: "add-key" });
      return;
    }

    // Delete
    if (input === "D") {
      if (!k) return;
      setMode({ type: "confirm-delete", key: k });
      return;
    }

    // Diff
    if (input === "d") {
      setMode({ type: "diff" });
      return;
    }

    // Encrypt / decrypt file
    if (input === "e") {
      setMode({ type: "confirm-encrypt" });
      return;
    }
  }, { isActive: isRawModeSupported && mode.type === "normal" });

  // --- mode renderers ---

  if (mode.type === "edit") {
    const editing = mode.key;
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus} interactive={false}
        extra={
          <InlineForm
            label={`Edit ${editing.key}`}
            initialValue={editing.value}
            onSubmit={(val) => {
              if (editing.encrypted) {
                encryptKey(selectedFile.path, editing.key, val);
              } else {
                updateKey(selectedFile.path, editing.key, val);
              }
              setRevealed((prev) => { const next = new Map(prev); next.delete(editing.key); return next; });
              refreshKeys();
              setMode({ type: "normal" });
              flash(`Saved ${editing.key}`);
            }}
            onCancel={() => setMode({ type: "normal" })}
          />
        }
      />
    );
  }

  if (mode.type === "add-key") {
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus} interactive={false}
        extra={
          <InlineForm
            key="add-key"
            label="New key name"
            onSubmit={(keyName) => {
              if (!keyName.trim()) { setMode({ type: "normal" }); return; }
              setMode({ type: "add-value", keyName: keyName.trim() });
            }}
            onCancel={() => setMode({ type: "normal" })}
          />
        }
      />
    );
  }

  if (mode.type === "add-value") {
    const { keyName } = mode;
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus} interactive={false}
        extra={
          <InlineForm
            key="add-value"
            label={`Value for ${keyName}`}
            onSubmit={(val) => {
              if (selectedFile.encrypted) {
                setMode({ type: "confirm-add-encrypt", keyName, value: val });
              } else {
                addKey(selectedFile.path, keyName, val);
                refreshKeys();
                setKeyIndex(keys.length);
                setMode({ type: "normal" });
                flash(`Added ${keyName}`);
              }
            }}
            onCancel={() => setMode({ type: "normal" })}
          />
        }
      />
    );
  }

  if (mode.type === "confirm-add-encrypt") {
    const { keyName, value: newVal } = mode;
    const commit = (encrypt: boolean) => {
      addKey(selectedFile.path, keyName, newVal);
      if (encrypt) encryptKey(selectedFile.path, keyName, newVal);
      refreshKeys();
      setKeyIndex(keys.length);
      setMode({ type: "normal" });
      flash(`Added ${keyName}${encrypt ? " (encrypted)" : ""}`);
    };
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus} interactive={false}
        extra={<ConfirmAddEncrypt keyName={keyName} onEncrypt={() => commit(true)} onPlain={() => commit(false)} onCancel={() => setMode({ type: "normal" })} />}
      />
    );
  }

  if (mode.type === "confirm-delete") {
    const { key: k } = mode;
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus} interactive={false}
        extra={<ConfirmDelete keyName={k.key}
          onConfirm={() => {
            removeKey(selectedFile.path, k.key);
            refreshKeys();
            setKeyIndex(Math.max(0, keyIndex - 1));
            setMode({ type: "normal" });
            flash(`Deleted ${k.key}`);
          }}
          onCancel={() => setMode({ type: "normal" })}
        />}
      />
    );
  }

  if (mode.type === "confirm-encrypt") {
    const isEncrypted = selectedFile.encrypted;
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus} interactive={false}
        extra={<ConfirmEncrypt
          decrypt={isEncrypted}
          fileName={selectedFile.relativePath}
          onConfirm={() => {
            try {
              if (isEncrypted) {
                decryptFile(selectedFile.path);
                flash(`Decrypted ${selectedFile.relativePath}`);
              } else {
                encryptFile(selectedFile.path);
                flash(`Encrypted ${selectedFile.relativePath}`);
              }
            } catch (err) {
              flash(`Error: ${err instanceof Error ? err.message : String(err)}`);
            }
            refreshKeys();
            setRevealed(new Map());
            setMode({ type: "normal" });
          }}
          onCancel={() => setMode({ type: "normal" })}
        />}
      />
    );
  }

  if (mode.type === "help") {
    return <HelpOverlay onClose={() => setMode({ type: "normal" })} />;
  }

  if (mode.type === "diff") {
    return (
      <DiffView
        left={selectedFile}
        files={files}
        onClose={() => setMode({ type: "normal" })}
      />
    );
  }

  return (
    <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
      focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
      statusMsg={statusMsg} focus2={focus} interactive={true}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type LayoutProps = {
  files: EnvFile[];
  fileIndex: number;
  keys: EnvKey[];
  keyIndex: number;
  focus: Focus;
  focus2: Focus;
  interactive: boolean;
  revealed: Map<string, string>;
  onSelectFile: (i: number) => void;
  onSelectKey: (i: number) => void;
  statusMsg?: string;
  extra?: React.ReactNode;
};

function Layout({ files, fileIndex, keys, keyIndex, focus, interactive, revealed,
  onSelectFile, onSelectKey, statusMsg, extra }: LayoutProps) {
  const selectedFile = files[fileIndex]!;
  const encCount = files.filter((f) => f.encrypted).length;
  const termRows = useTerminalRows();
  const termCols = useTerminalCols();

  // Fixed chrome: app header (1) + status bar (2) + preview bar (2, when visible) = 5 or 3.
  const listRows = Math.max(3, termRows - (extra ? 3 : 5));

  return (
    <Box flexDirection="column" height={termRows}>
      <Box paddingX={1}>
        <Text bold color="cyan">dotenvx-ui</Text>
        <Text dimColor>  {selectedFile.relativePath}  ·  {files.length} files  ·  {encCount} enc</Text>
      </Box>
      <Box height={listRows}>
        <FileList files={files} selectedIndex={fileIndex} focused={focus === "files"} interactive={interactive} onSelect={onSelectFile} />
        <KeyTable file={selectedFile} keys={keys} selectedIndex={keyIndex}
          focused={focus === "keys"} interactive={interactive} revealed={revealed} onSelect={onSelectKey}
          maxRows={listRows} />
      </Box>
      {extra}
      {!extra && <ValuePreview keys={keys} keyIndex={keyIndex} focus={focus} revealed={revealed} width={termCols} />}
      <StatusBar focus={focus} message={statusMsg} />
    </Box>
  );
}

function ValuePreview({ keys, keyIndex, focus, revealed, width }: {
  keys: EnvKey[];
  keyIndex: number;
  focus: Focus;
  revealed: Map<string, string>;
  width: number;
}) {
  if (focus !== "keys") return null;
  const k = keys[keyIndex];
  if (!k) return null;

  let value: string;
  if (k.encrypted) {
    value = revealed.has(k.key) ? revealed.get(k.key)! : "••••  (press r to reveal)";
  } else {
    value = revealed.has(k.key) ? revealed.get(k.key)! : k.value;
  }

  const flat = value.replace(/\n/g, "↵ ");

  return (
    <Box
      borderStyle="single"
      borderTop borderBottom={false} borderLeft={false} borderRight={false}
      paddingX={1}
      width={width}
    >
      <Text bold color="cyan">{k.key}  </Text>
      <Text dimColor>·  </Text>
      <Text truncate>{flat}</Text>
    </Box>
  );
}

type ConfirmDeleteProps = {
  keyName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmDelete({ keyName, onConfirm, onCancel }: ConfirmDeleteProps) {
  const { isRawModeSupported } = useStdin();
  useInput((input) => {
    if (input === "y" || input === "Y") onConfirm();
    else onCancel();
  }, { isActive: isRawModeSupported });

  return (
    <Box paddingX={1}>
      <Text color="red">Delete <Text bold>{keyName}</Text>? </Text>
      <Text dimColor>y confirm  any other key cancel</Text>
    </Box>
  );
}

type ConfirmEncryptProps = {
  decrypt: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmEncrypt({ decrypt, fileName, onConfirm, onCancel }: ConfirmEncryptProps) {
  const { isRawModeSupported } = useStdin();
  useInput((input) => {
    if (input === "y" || input === "Y") onConfirm();
    else onCancel();
  }, { isActive: isRawModeSupported });

  const action = decrypt ? "Decrypt" : "Encrypt";
  const color = decrypt ? "yellow" : "green";
  return (
    <Box paddingX={1}>
      <Text color={color}>{action} <Text bold>{fileName}</Text>? </Text>
      <Text dimColor>y confirm  any other key cancel</Text>
    </Box>
  );
}

type ConfirmAddEncryptProps = {
  keyName: string;
  onEncrypt: () => void;
  onPlain: () => void;
  onCancel: () => void;
};

function ConfirmAddEncrypt({ keyName, onEncrypt, onPlain, onCancel }: ConfirmAddEncryptProps) {
  const { isRawModeSupported } = useStdin();
  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (input === "y" || input === "Y") { onEncrypt(); return; }
    if (input === "n" || input === "N" || key.return) { onPlain(); return; }
  }, { isActive: isRawModeSupported });

  return (
    <Box paddingX={1}>
      <Text>Encrypt <Text bold>{keyName}</Text>? </Text>
      <Text dimColor>y encrypt  n plain  esc cancel</Text>
    </Box>
  );
}
