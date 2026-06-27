import React, { useState, useEffect } from "react";
import { Copy, Check, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { api } from "./api.js";
import type { EnvFile, EnvKey } from "./types.js";

type Props = {
  file: EnvFile;
  files: EnvFile[];
  onRefresh: () => Promise<void>;
  onDiff: () => void;
};

type EditState = { key: string; value: string } | null;
type AddState = { key: string; value: string } | null;
type Flash = { msg: string; isError?: boolean } | null;

export function KeyTable({ file, onRefresh, onDiff }: Props) {
  const [editing, setEditing] = useState<EditState>(null);
  const [adding, setAdding] = useState<AddState>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [allRevealed, setAllRevealed] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setAllRevealed(false);
    setRevealedKeys(new Set());
    setRevealedValues({});
    setEditing(null);
    setAdding(null);
    setDeleting(null);
  }, [file.path]);

  const showFlash = (msg: string, isError = false) => {
    setFlash({ msg, isError });
    setTimeout(() => setFlash(null), 1800);
  };

  const handleToggleRevealAll = async () => {
    if (allRevealed) {
      setAllRevealed(false);
      setRevealedKeys(new Set());
      setRevealedValues({});
      return;
    }
    setAllRevealed(true);
    if (!file.encrypted) return;
    setDecrypting(true);
    try {
      const { values } = await api.decryptAll(file.path);
      const newKeys = new Set(revealedKeys);
      const newValues = { ...revealedValues };
      for (const [k, v] of Object.entries(values)) {
        newValues[k] = v;
        newKeys.add(k);
      }
      setRevealedValues(newValues);
      setRevealedKeys(newKeys);
    } catch {
      showFlash("Private key not available", true);
      setAllRevealed(false);
    } finally {
      setDecrypting(false);
    }
  };

  const handleRevealEncrypted = async (k: EnvKey) => {
    if (revealedKeys.has(k.key)) {
      setRevealedKeys((s) => { const n = new Set(s); n.delete(k.key); return n; });
      return;
    }
    try {
      const { value } = await api.decrypt(file.path, k.key);
      setRevealedValues((r) => ({ ...r, [k.key]: value }));
      setRevealedKeys((s) => new Set(s).add(k.key));
    } catch {
      showFlash("Private key not available", true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.putKey(file.path, editing.key, editing.value, false);
      await onRefresh();
      setEditing(null);
      showFlash("Saved");
    } catch (e) {
      showFlash(String(e), true);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!adding || !adding.key.trim()) return;
    setBusy(true);
    try {
      await api.putKey(file.path, adding.key.trim(), adding.value.trim(), true);
      await onRefresh();
      setAdding(null);
      showFlash("Added");
    } catch (e) {
      showFlash(String(e), true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (key: string) => {
    setBusy(true);
    try {
      await api.deleteKey(file.path, key);
      await onRefresh();
      setDeleting(null);
      showFlash("Deleted");
    } catch (e) {
      showFlash(String(e), true);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async (k: EnvKey) => {
    let val = getPlainValue(k);
    if (val === null) {
      try {
        const { value } = await api.decrypt(file.path, k.key);
        setRevealedValues((r) => ({ ...r, [k.key]: value }));
        setRevealedKeys((s) => new Set(s).add(k.key));
        val = value;
      } catch {
        showFlash("Private key not available", true);
        return;
      }
    }
    await navigator.clipboard.writeText(val);
    setCopied(k.key);
    setTimeout(() => setCopied(null), 1200);
  };

  const getPlainValue = (k: EnvKey): string | null => {
    if (k.encrypted) return revealedKeys.has(k.key) ? revealedValues[k.key] : null;
    return k.value;
  };

  const visibleValue = (k: EnvKey): string => {
    if (k.encrypted) {
      return revealedKeys.has(k.key) ? revealedValues[k.key] : "••••••••••••";
    }
    return allRevealed ? k.value : maskValue(k.value);
  };

  const isHidden = (k: EnvKey): boolean =>
    k.encrypted ? !revealedKeys.has(k.key) : !allRevealed;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-[#2A2A2E] bg-[#141416] shrink-0">
        <span className="font-mono text-[13px] font-medium text-[#F0F0F2] flex-1 truncate">{file.relativePath}</span>
        <span className="text-[11px] text-[#8A8A96]">{file.keys.length} key{file.keys.length !== 1 ? "s" : ""}</span>
        {file.encrypted && (
          <span className="text-[11px] font-medium px-2 h-5 leading-5 rounded-full bg-violet-950/50 text-violet-400">
            encrypted
          </span>
        )}
        <div className="flex gap-2 ml-2">
          <button
            onClick={handleToggleRevealAll}
            disabled={decrypting}
            className="h-8 px-3 rounded-md text-[13px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] disabled:text-[#52525C] cursor-pointer disabled:cursor-default transition-colors"
          >
            {decrypting ? "Decrypting…" : allRevealed ? "Hide all" : "Reveal all"}
          </button>
          <button
            onClick={onDiff}
            className="h-8 px-3 rounded-md text-[13px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] cursor-pointer transition-colors"
          >
            Diff
          </button>
          <button
            onClick={() => setAdding({ key: "", value: "" })}
            className="h-8 px-3 rounded-md text-[13px] font-medium bg-violet-700 hover:bg-violet-600 text-white cursor-pointer transition-colors"
          >
            Add variable
          </button>
        </div>
      </div>

      {/* Flash */}
      {flash && (
        <div className={`px-4 h-8 leading-8 text-[11px] border-b border-[#2A2A2E] bg-[#1C1C1F] shrink-0 ${flash.isError ? "text-red-500" : "text-green-500"}`}>
          {flash.msg}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className="sticky top-0 bg-[#0D0D0F] px-4 h-8 text-left text-[11px] font-medium text-[#52525C] border-b border-[#2A2A2E] w-60">Key</th>
              <th className="sticky top-0 bg-[#0D0D0F] px-4 h-8 text-left text-[11px] font-medium text-[#52525C] border-b border-[#2A2A2E]">Value</th>
              <th className="sticky top-0 bg-[#0D0D0F] px-4 h-8 border-b border-[#2A2A2E] w-30"></th>
            </tr>
          </thead>
          <tbody>
            {file.keys.length === 0 && !adding && (
              <tr>
                <td colSpan={3}>
                  <div className="py-8 text-center text-[13px] text-[#52525C]">
                    No keys found —{" "}
                    <button
                      onClick={() => setAdding({ key: "", value: "" })}
                      className="text-violet-500 underline cursor-pointer"
                    >
                      add one
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {file.keys.map((k) => {
              const isEditing = editing?.key === k.key;
              const isDeleting = deleting === k.key;

              return (
                <tr key={k.key} className="group h-10 hover:bg-[#232326]">
                  <td className="px-4 border-b border-[#2A2A2E] font-mono text-[13px] font-medium text-[#F0F0F2] whitespace-nowrap overflow-hidden text-ellipsis align-middle">
                    {k.key}
                  </td>
                  <td className="px-4 border-b border-[#2A2A2E] overflow-hidden align-middle">
                    {isEditing ? (
                      <textarea
                        className="w-full bg-[#141416] border border-violet-600 rounded-md shadow-[0_0_0_3px_#6D28D933] px-2 py-1 text-[#F0F0F2] font-mono text-[13px] outline-none resize-y min-h-8 leading-relaxed"
                        value={editing.value}
                        autoFocus
                        rows={Math.max(2, editing.value.split("\n").length)}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditing(null);
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEdit();
                        }}
                      />
                    ) : (
                      <span
                        className={`block font-mono text-[13px] whitespace-nowrap overflow-hidden text-ellipsis ${isHidden(k) ? "text-[#52525C] tracking-widest" : "text-[#8A8A96]"}`}
                        title={k.encrypted ? (revealedKeys.has(k.key) ? revealedValues[k.key] : undefined) : k.value}
                      >
                        {visibleValue(k)}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 border-b border-[#2A2A2E] text-right whitespace-nowrap align-middle w-30 ${isEditing || isDeleting ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity duration-100`}>
                    {isEditing ? (
                      <span className="flex justify-end gap-1">
                        <button onClick={() => setEditing(null)} className="h-6 px-2 rounded border border-[#3A3A40] text-[11px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] cursor-pointer">Cancel</button>
                        <button onClick={handleSaveEdit} disabled={busy} className="h-6 px-2 rounded border border-[#3A3A40] text-[11px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] cursor-pointer disabled:opacity-50">Save</button>
                      </span>
                    ) : isDeleting ? (
                      <span className="flex items-center justify-end gap-1">
                        <span className="text-[11px] text-red-500 mr-1">Delete {k.key}?</span>
                        <button onClick={() => setDeleting(null)} className="h-6 px-2 rounded border border-[#3A3A40] text-[11px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] cursor-pointer">No</button>
                        <button onClick={() => handleDelete(k.key)} disabled={busy} className="h-6 px-2 rounded border border-red-800 text-[11px] font-medium text-red-500 hover:bg-red-950/50 cursor-pointer disabled:opacity-50">Yes</button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-0.5">
                        <button
                          title="Copy value"
                          onClick={() => handleCopy(k)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A8A96] hover:bg-[#1C1C1F] hover:text-[#F0F0F2] cursor-pointer transition-colors"
                        >
                          {copied === k.key ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        {k.encrypted && (
                          <button
                            title={revealedKeys.has(k.key) ? "Hide value" : "Reveal value"}
                            onClick={() => handleRevealEncrypted(k)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A8A96] hover:bg-[#1C1C1F] hover:text-[#F0F0F2] cursor-pointer transition-colors"
                          >
                            {revealedKeys.has(k.key) ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button
                          title="Edit value"
                          onClick={async () => {
                            if (k.encrypted && !revealedKeys.has(k.key)) {
                              try {
                                const { value } = await api.decrypt(file.path, k.key);
                                setRevealedValues((r) => ({ ...r, [k.key]: value }));
                                setRevealedKeys((s) => new Set(s).add(k.key));
                                setEditing({ key: k.key, value });
                              } catch {
                                showFlash("Private key not available", true);
                              }
                            } else {
                              setEditing({ key: k.key, value: getPlainValue(k) ?? k.value });
                            }
                          }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A8A96] hover:bg-[#1C1C1F] hover:text-[#F0F0F2] cursor-pointer transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Delete key"
                          onClick={() => setDeleting(k.key)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A8A96] hover:bg-red-950/50 hover:text-red-500 cursor-pointer transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {adding && (
              <tr className="bg-[#1C1C1F]">
                <td className="px-4 py-2 border-b border-[#2A2A2E] align-top">
                  <input
                    className="w-full h-8 bg-[#141416] border border-violet-600 rounded-md shadow-[0_0_0_3px_#6D28D933] px-2 text-[#F0F0F2] font-mono text-[13px] font-medium outline-none placeholder:text-[#52525C] placeholder:font-normal"
                    placeholder="KEY_NAME"
                    value={adding.key}
                    autoFocus
                    onChange={(e) => setAdding({ ...adding, key: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Escape") setAdding(null); }}
                  />
                </td>
                <td className="px-4 py-2 border-b border-[#2A2A2E] align-top">
                  <textarea
                    className="w-full bg-[#141416] border border-violet-600 rounded-md shadow-[0_0_0_3px_#6D28D933] px-2 py-1 text-[#F0F0F2] font-mono text-[13px] outline-none resize-y min-h-8 leading-relaxed placeholder:text-[#52525C]"
                    placeholder="value"
                    value={adding.value}
                    rows={2}
                    onChange={(e) => setAdding({ ...adding, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
                      if (e.key === "Escape") setAdding(null);
                    }}
                  />
                </td>
                <td className="px-4 py-2 border-b border-[#2A2A2E] text-right whitespace-nowrap align-top w-30">
                  <span className="flex justify-end gap-1 mt-1">
                    <button onClick={() => setAdding(null)} className="h-6 px-2 rounded border border-[#3A3A40] text-[11px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] cursor-pointer">Cancel</button>
                    <button onClick={handleAdd} disabled={busy} className="h-6 px-2 rounded border border-[#3A3A40] text-[11px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] cursor-pointer disabled:opacity-50">Save</button>
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function maskValue(value: string): string {
  if (value.length === 0) return "";
  const visible = Math.min(4, Math.floor(value.length / 2));
  return value.slice(0, visible) + "•".repeat(Math.min(8, value.length - visible));
}
