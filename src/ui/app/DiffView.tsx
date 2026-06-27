import React, { useState, useEffect } from "react";
import { api } from "./api.js";
import type { EnvFile } from "./types.js";

type Props = {
  file: EnvFile;
  files: EnvFile[];
  onClose: () => void;
};

type RowStatus = "left-only" | "right-only" | "same" | "diff";

function maskValue(value: string, key: string): string {
  const SECRET = /secret|password|token|key|private|api_?key/i;
  if (SECRET.test(key)) {
    const visible = Math.min(4, Math.floor(value.length / 2));
    return value.slice(0, visible) + "••••";
  }
  const first = value.split("\n")[0]!;
  return first.length > 32 ? first.slice(0, 31) + "…" : first;
}

async function resolveValues(file: EnvFile): Promise<Map<string, string>> {
  const plain = new Map(file.keys.filter((k) => !k.encrypted).map((k) => [k.key, k.value]));
  if (!file.encrypted) return plain;
  try {
    const { values } = await api.decryptAll(file.path);
    for (const [k, v] of Object.entries(values)) plain.set(k, v);
  } catch {
    // private key not available
  }
  return plain;
}

export function DiffView({ file, files, onClose }: Props) {
  const others = files.filter((f) => f.path !== file.path);
  const [targetPath, setTargetPath] = useState(others[0]?.path ?? "");
  const [leftValues, setLeftValues] = useState<Map<string, string> | null>(null);
  const [rightValues, setRightValues] = useState<Map<string, string> | null>(null);

  const target = files.find((f) => f.path === targetPath) ?? null;

  useEffect(() => {
    setLeftValues(null);
    resolveValues(file).then(setLeftValues);
  }, [file.path]);

  useEffect(() => {
    if (!target) { setRightValues(null); return; }
    setRightValues(null);
    resolveValues(target).then(setRightValues);
  }, [targetPath]);

  const leftKeys = new Map(file.keys.map((k) => [k.key, k]));
  const rightKeys = new Map(target?.keys.map((k) => [k.key, k]) ?? []);
  const allKeys = Array.from(new Set([...leftKeys.keys(), ...rightKeys.keys()])).sort();

  const status = (key: string): RowStatus => {
    const l = leftKeys.has(key);
    const r = rightKeys.has(key);
    if (!l) return "right-only";
    if (!r) return "left-only";
    const lVal = leftValues?.get(key);
    const rVal = rightValues?.get(key);
    if (lVal === undefined || rVal === undefined) return "diff";
    return lVal === rVal ? "same" : "diff";
  };

  const counts = { "left-only": 0, "right-only": 0, same: 0, diff: 0 };
  for (const key of allKeys) counts[status(key)]++;

  const loading = leftValues === null || rightValues === null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 h-10 border-b border-[#2A2A2E] bg-[#141416] shrink-0">
        <span className="text-[13px] font-semibold text-[#F0F0F2]">Diff</span>
        <span className="font-mono text-[13px] text-[#8A8A96]">{file.relativePath}</span>
        <span className="text-[11px] text-[#52525C]">vs</span>
        <select
          className="h-8 flex-1 max-w-xs bg-[#141416] border border-[#2A2A2E] rounded-md text-[#F0F0F2] font-mono text-[13px] px-2 outline-none focus:border-violet-600 focus:shadow-[0_0_0_3px_#6D28D933] cursor-pointer"
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
        >
          {others.map((f) => (
            <option key={f.path} value={f.path}>{f.relativePath}</option>
          ))}
        </select>
        <button
          onClick={onClose}
          className="ml-auto h-8 px-3 rounded-md border border-[#3A3A40] text-[13px] font-medium text-[#8A8A96] hover:text-[#F0F0F2] hover:border-[#8A8A96] cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 h-8 items-center border-b border-[#2A2A2E] bg-[#0D0D0F] shrink-0 text-[11px]">
        <span className="flex items-center gap-1.5 text-green-600">
          <span className="w-2 h-2 rounded-sm bg-green-600 inline-block" />
          Same ({counts.same})
        </span>
        <span className="flex items-center gap-1.5 text-[#52525C]">
          <span className="w-2 h-2 rounded-sm bg-[#3A3A40] inline-block" />
          Different ({counts.diff})
        </span>
        <span className="flex items-center gap-1.5 text-[#52525C]">
          <span className="w-2 h-2 rounded-sm bg-[#3A3A40] inline-block" />
          Left only ({counts["left-only"]})
        </span>
        <span className="flex items-center gap-1.5 text-[#52525C]">
          <span className="w-2 h-2 rounded-sm bg-[#3A3A40] inline-block" />
          Right only ({counts["right-only"]})
        </span>
      </div>

      {others.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#52525C] text-[13px]">
          No other files to compare.
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-[#52525C] text-[13px]">
          Decrypting…
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="sticky top-0 bg-[#0D0D0F] px-4 h-8 text-left text-[11px] font-medium text-[#52525C] border-b border-[#2A2A2E] w-1/3">Key</th>
                <th className="sticky top-0 bg-[#0D0D0F] px-4 h-8 text-left text-[11px] font-medium text-[#52525C] border-b border-[#2A2A2E] w-1/3">{file.relativePath}</th>
                <th className="sticky top-0 bg-[#0D0D0F] px-4 h-8 text-left text-[11px] font-medium text-[#52525C] border-b border-[#2A2A2E] w-1/3">{target?.relativePath ?? "—"}</th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map((key) => {
                const s = status(key);
                const lVal = leftValues?.get(key);
                const rVal = rightValues?.get(key);
                const same = s === "same";
                return (
                  <tr key={key} className="h-9 hover:bg-[#232326]">
                    <td className="px-4 border-b border-[#2A2A2E] font-mono text-[13px] font-medium text-[#F0F0F2] overflow-hidden text-ellipsis whitespace-nowrap align-middle">
                      {key}
                    </td>
                    <td className="px-4 border-b border-[#2A2A2E] font-mono text-[13px] overflow-hidden text-ellipsis whitespace-nowrap align-middle">
                      {leftKeys.has(key)
                        ? <span className={same ? "text-green-600" : "text-[#8A8A96]"}>
                            {lVal !== undefined ? maskValue(lVal, key) : "🔒"}
                          </span>
                        : <span className="text-[#52525C]">—</span>}
                    </td>
                    <td className="px-4 border-b border-[#2A2A2E] font-mono text-[13px] overflow-hidden text-ellipsis whitespace-nowrap align-middle">
                      {rightKeys.has(key)
                        ? <span className={same ? "text-green-600" : "text-[#8A8A96]"}>
                            {rVal !== undefined ? maskValue(rVal, key) : "🔒"}
                          </span>
                        : <span className="text-[#52525C]">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
