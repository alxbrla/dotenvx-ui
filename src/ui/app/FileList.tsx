import React from "react";
import type { EnvFile } from "./types.js";

type Props = {
  files: EnvFile[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
};

export function FileList({ files, selectedPath, onSelect }: Props) {
  const groups = groupByPackage(files);

  return (
    <aside className="w-55 shrink-0 border-r border-[#2A2A2E] bg-[#141416] overflow-y-auto py-2">
      {groups.map(([pkg, pkgFiles]) => (
        <div key={pkg} className="mb-1">
          <div className="px-3 py-1.5 text-[11px] font-medium text-[#52525C] truncate">{pkg}</div>
          {pkgFiles.map((f) => {
            const active = f.path === selectedPath;
            return (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                className={[
                  "flex items-center gap-2 w-full h-8 px-3 text-left text-[13px] border-l-2 transition-colors duration-100 cursor-pointer",
                  active
                    ? "bg-[#1C1C1F] border-violet-600 text-[#F0F0F2]"
                    : "border-transparent text-[#8A8A96] hover:bg-[#232326] hover:text-[#F0F0F2]",
                ].join(" ")}
              >
                <span className="flex-1 truncate">{f.environment}</span>
                {f.encrypted && (
                  <span className="shrink-0 text-[11px] font-medium px-1.5 h-5 leading-5 rounded-full bg-violet-950/50 text-violet-400">
                    enc
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

function groupByPackage(files: EnvFile[]): [string, EnvFile[]][] {
  const map = new Map<string, EnvFile[]>();
  for (const f of files) {
    const list = map.get(f.package) ?? [];
    list.push(f);
    map.set(f.package, list);
  }
  return Array.from(map.entries());
}
