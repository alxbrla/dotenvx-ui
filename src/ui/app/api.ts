import type { EnvFile } from "./types.js";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  files: () =>
    fetch("/api/files").then((r) => json<EnvFile[]>(r)),

  file: (path: string) =>
    fetch(`/api/file?path=${encodeURIComponent(path)}`).then((r) => json<EnvFile>(r)),

  putKey: (path: string, key: string, value: string, isNew: boolean) =>
    fetch("/api/key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, key, value, isNew }),
    }).then((r) => json<{ ok: boolean }>(r)),

  deleteKey: (path: string, key: string) =>
    fetch("/api/key", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, key }),
    }).then((r) => json<{ ok: boolean }>(r)),

  decrypt: (path: string, key: string) =>
    fetch("/api/decrypt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, key }),
    }).then((r) => json<{ value: string }>(r)),

  decryptAll: (path: string) =>
    fetch("/api/decrypt-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).then((r) => json<{ values: Record<string, string> }>(r)),
};
