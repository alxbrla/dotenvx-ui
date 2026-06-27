import { Router } from "express";
import {
  decryptAllValues,
  decryptValue,
  isEncryptedValue,
} from "../core/dotenvx.js";
import {
  addKey,
  readEnvFile,
  removeKey,
  updateKey,
} from "../core/parser/index.js";
import { scan } from "../core/scanner.js";
import type { EnvFile } from "../core/types.js";

export function createRouter(cwd: string): Router {
  const router = Router();

  const scanWithKeys = (): EnvFile[] =>
    scan(cwd).map((f) => ({ ...f, keys: readEnvFile(f.path) }));

  let files: EnvFile[] = scanWithKeys();
  const decryptCache = new Map<string, Record<string, string>>();

  const refresh = () => {
    files = scanWithKeys();
    decryptCache.clear();
  };
  const findFile = (path: string) => files.find((f) => f.path === path);

  router.get("/api/files", (_req, res) => {
    res.json(files);
  });

  router.get("/api/file", (req, res) => {
    const file = findFile(req.query.path as string);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.json(file);
  });

  router.put("/api/key", (req, res) => {
    const { path, key, value, isNew } = req.body as {
      path: string;
      key: string;
      value: string;
      isNew?: boolean;
    };
    if (!path || !key) {
      res.status(400).json({ error: "path and key are required" });
      return;
    }
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

  router.delete("/api/key", (req, res) => {
    const { path, key } = req.body as { path: string; key: string };
    if (!path || !key) {
      res.status(400).json({ error: "path and key are required" });
      return;
    }
    try {
      removeKey(path, key);
      refresh();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/api/decrypt", (req, res) => {
    const { path, key } = req.body as { path: string; key: string };
    if (!path || !key) {
      res.status(400).json({ error: "path and key are required" });
      return;
    }
    const file = findFile(path);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const envKey = file.keys.find((k) => k.key === key);
    if (!envKey) {
      res.status(404).json({ error: "Key not found" });
      return;
    }
    if (!envKey.encrypted) {
      res.json({ value: envKey.value });
      return;
    }
    const decrypted = decryptValue(envKey.value, path);
    if (decrypted === null || isEncryptedValue(decrypted)) {
      res.status(403).json({ error: "Private key not available" });
      return;
    }
    res.json({ value: decrypted });
  });

  router.post("/api/decrypt-all", (req, res) => {
    const { path } = req.body as { path: string };
    if (!path) {
      res.status(400).json({ error: "path is required" });
      return;
    }
    const file = findFile(path);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const values = decryptAllValues(path);
    res.json({ values });
  });

  return router;
}
