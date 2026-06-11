import React, { useState } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import clipboard from "clipboardy";
import { FileList } from "./FileList.js";
import { KeyTable } from "./KeyTable.js";
import { StatusBar } from "./StatusBar.js";
import { InlineForm } from "./InlineForm.js";
import { readEnvFile, addKey, updateKey, removeKey } from "../core/parser/index.js";
import { decryptValue, encryptFile, decryptFile, encryptKey } from "../core/dotenvx.js";
import type { EnvFile, EnvKey } from "../core/types.js";

type Props = { files: EnvFile[] };
type Focus = "files" | "keys";
type Mode =
  | { type: "normal" }
  | { type: "edit"; key: EnvKey }
  | { type: "add-key" }
  | { type: "add-value"; keyName: string }
  | { type: "confirm-delete"; key: EnvKey }
  | { type: "confirm-encrypt" };

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
    if (mode.type !== "normal") return;

    if (input === "q" || key.escape) { exit(); return; }

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
      const next = new Map<string, string>();
      for (const entry of keys) {
        if (entry.encrypted) {
          const plain = decryptValue(entry.value, selectedFile.path);
          if (plain === null) { flash("🔒 Private key not found — cannot reveal all"); return; }
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
        statusMsg={statusMsg} focus2={focus}
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
        statusMsg={statusMsg} focus2={focus}
        extra={
          <InlineForm
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
        statusMsg={statusMsg} focus2={focus}
        extra={
          <InlineForm
            label={`Value for ${keyName}`}
            onSubmit={(val) => {
              addKey(selectedFile.path, keyName, val);
              refreshKeys();
              setKeyIndex(keys.length);
              setMode({ type: "normal" });
              flash(`Added ${keyName}`);
            }}
            onCancel={() => setMode({ type: "normal" })}
          />
        }
      />
    );
  }

  if (mode.type === "confirm-delete") {
    const { key: k } = mode;
    return (
      <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
        focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
        statusMsg={statusMsg} focus2={focus}
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
        statusMsg={statusMsg} focus2={focus}
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

  return (
    <Layout files={files} fileIndex={fileIndex} keys={keys} keyIndex={keyIndex}
      focus={focus} revealed={revealed} onSelectFile={selectFile} onSelectKey={setKeyIndex}
      statusMsg={statusMsg} focus2={focus}
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
  revealed: Map<string, string>;
  onSelectFile: (i: number) => void;
  onSelectKey: (i: number) => void;
  statusMsg?: string;
  extra?: React.ReactNode;
};

function Layout({ files, fileIndex, keys, keyIndex, focus, revealed,
  onSelectFile, onSelectKey, statusMsg, extra }: LayoutProps) {
  const selectedFile = files[fileIndex]!;
  const encCount = files.filter((f) => f.encrypted).length;

  return (
    <Box flexDirection="column" height="100%">
      <Box paddingX={1}>
        <Text bold color="cyan">dotenvx-ui</Text>
        <Text dimColor>  {selectedFile.relativePath}  ·  {files.length} files  ·  {encCount} enc</Text>
      </Box>
      <Box flexGrow={1}>
        <FileList files={files} selectedIndex={fileIndex} focused={focus === "files"} onSelect={onSelectFile} />
        <KeyTable file={selectedFile} keys={keys} selectedIndex={keyIndex}
          focused={focus === "keys"} revealed={revealed} onSelect={onSelectKey} />
      </Box>
      {extra}
      <StatusBar focus={focus} message={statusMsg} />
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
