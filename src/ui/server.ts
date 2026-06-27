import express from "express";
import getPort from "get-port";
import open from "open";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "../core/scanner.js";
import { readEnvFile, addKey, updateKey, removeKey } from "../core/parser/index.js";
import { decryptValue, decryptAllValues } from "../core/dotenvx.js";
import type { EnvFile } from "../core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDist = join(__dirname, "ui");

export async function startServer(cwd: string): Promise<void> {
  const port = await getPort();
  const app = express();
  app.use(express.json());

  const scanWithKeys = (): EnvFile[] =>
    scan(cwd).map((f) => ({ ...f, keys: readEnvFile(f.path) }));

  let files: EnvFile[] = scanWithKeys();
  const decryptCache = new Map<string, Record<string, string>>();

  const refresh = () => { files = scanWithKeys(); decryptCache.clear(); };

  const findFile = (path: string) => files.find((f) => f.path === path);

  app.get("/api/files", (_req, res) => {
    res.json(files);
  });

  app.get("/api/file", (req, res) => {
    const file = findFile(req.query.path as string);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    res.json(file);
  });

  app.put("/api/key", (req, res) => {
    const { path, key, value, isNew } = req.body as { path: string; key: string; value: string; isNew?: boolean };
    if (!path || !key) { res.status(400).json({ error: "path and key are required" }); return; }
    try {
      if (isNew) {
        addKey(path, key, value ?? "");
      } else {
        updateKey(path, key, value ?? "");
      }
      refresh();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete("/api/key", (req, res) => {
    const { path, key } = req.body as { path: string; key: string };
    if (!path || !key) { res.status(400).json({ error: "path and key are required" }); return; }
    try {
      removeKey(path, key);
      refresh();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/decrypt", (req, res) => {
    const { path, key } = req.body as { path: string; key: string };
    if (!path || !key) { res.status(400).json({ error: "path and key are required" }); return; }
    const file = findFile(path);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    const envKey = file.keys.find((k) => k.key === key);
    if (!envKey) { res.status(404).json({ error: "Key not found" }); return; }
    if (!envKey.encrypted) { res.json({ value: envKey.value }); return; }
    const decrypted = decryptValue(envKey.value, path);
    if (decrypted === null) {
      res.status(403).json({ error: "Private key not available" });
      return;
    }
    res.json({ value: decrypted });
  });

  // Decrypt all keys in a file in one pass — used by "Reveal all"
  app.post("/api/decrypt-all", (req, res) => {
    const { path } = req.body as { path: string };
    if (!path) { res.status(400).json({ error: "path is required" }); return; }
    const file = findFile(path);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    const values = decryptAllValues(path);
    res.json({ values });
  });

  app.use(express.static(uiDist));
  app.get("/{*path}", (_req, res) => res.sendFile(join(uiDist, "index.html")));

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`dotenvx-ui running at ${url}`);
    open(url);
  });

  process.on("SIGINT", () => {
    console.log("\ndotenvx-ui stopped.");
    process.exit(0);
  });
}
