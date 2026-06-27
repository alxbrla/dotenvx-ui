import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { DiffView } from "./DiffView.js";
import { FileList } from "./FileList.js";
import { KeyTable } from "./KeyTable.js";
import type { EnvFile } from "./types.js";

type View = "main" | "diff";

export function App() {
  const [files, setFiles] = useState<EnvFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [view, setView] = useState<View>("main");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.files();
      setFiles(data);
      if (data.length > 0 && selectedPath === null) {
        setSelectedPath(data[0].path);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [selectedPath]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedFile = files.find((f) => f.path === selectedPath) ?? null;

  const refresh = async () => {
    const data = await api.files();
    setFiles(data);
  };

  const encCount = files.filter((f) => f.encrypted).length;

  if (error) {
    return (
      <div className="p-8 text-red-500 text-sm font-sans">
        <p>Failed to connect to dotenvx-ui server.</p>
        <pre className="mt-2 font-mono text-[11px] text-[#52525C]">{error}</pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0D0D0F]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-10 border-b border-[#2A2A2E] bg-[#141416] shrink-0">
        <span className="text-[13px] font-semibold text-violet-500 tracking-wide">
          dotenvx-ui
        </span>
        <span className="text-[#52525C] text-[13px]">·</span>
        <span className="text-[11px] text-[#8A8A96]">
          {files.length} file{files.length !== 1 ? "s" : ""}
        </span>
        {encCount > 0 && (
          <>
            <span className="text-[#52525C] text-[13px]">·</span>
            <span className="text-[11px] text-[#8A8A96]">
              {encCount} encrypted
            </span>
          </>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <FileList
          files={files}
          selectedPath={selectedPath}
          onSelect={(path) => {
            setSelectedPath(path);
            setView("main");
          }}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          {view === "diff" && selectedFile ? (
            <DiffView
              file={selectedFile}
              files={files}
              onClose={() => setView("main")}
            />
          ) : selectedFile ? (
            <KeyTable
              file={selectedFile}
              files={files}
              onRefresh={refresh}
              onDiff={() => setView("diff")}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#52525C] text-[13px]">
              No file selected
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
