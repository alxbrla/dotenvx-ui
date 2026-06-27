import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import express from "express";
import { encryptFile } from "../core/dotenvx.js";
import { createRouter } from "../ui/router.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixture(): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "dotenvx-ui-server-"));
  const file = join(dir, ".env");
  writeFileSync(file, "FOO=bar\nBAZ=qux\n");
  return { dir, file };
}

function cleanup(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

async function json<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// Spins up a real HTTP server bound on a random port. Returns base URL + teardown fn.
function startTestServer(cwd: string): {
  url: string;
  close: () => Promise<void>;
} {
  const app = express();
  app.use(express.json());
  app.use(createRouter(cwd));

  const server = http.createServer(app);
  server.listen(0);
  const addr = server.address() as { port: number };
  const url = `http://localhost:${addr.port}`;
  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  return { url, close };
}

// ---------------------------------------------------------------------------
// GET /api/files
// ---------------------------------------------------------------------------

test("GET /api/files returns array of env files", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/files`);
    assert.equal(res.status, 200);
    const files = await json<unknown[]>(res);
    assert.ok(Array.isArray(files));
    assert.equal(files.length, 1);
    const f = files[0] as Record<string, unknown>;
    assert.equal(f.path, file);
    assert.ok(Array.isArray(f.keys));
  } finally {
    await close();
    cleanup(dir);
  }
});

test("GET /api/files includes parsed keys", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/files`);
    const [f] = await json<Array<Record<string, unknown[]>>>(res);
    assert.equal(f!.keys.length, 2);
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// GET /api/file
// ---------------------------------------------------------------------------

test("GET /api/file?path=... returns the matching file", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/file?path=${encodeURIComponent(file)}`);
    assert.equal(res.status, 200);
    const f = await json<Record<string, unknown>>(res);
    assert.equal(f.path, file);
  } finally {
    await close();
    cleanup(dir);
  }
});

test("GET /api/file?path=... returns 404 for unknown path", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(
      `${url}/api/file?path=${encodeURIComponent("/nonexistent/.env")}`,
    );
    assert.equal(res.status, 404);
    const body = await json<{ error: string }>(res);
    assert.ok(body.error.includes("not found"));
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/key — add
// ---------------------------------------------------------------------------

test("PUT /api/key with isNew=true adds a new key to the file", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: file,
        key: "NEW_KEY",
        value: "newval",
        isNew: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = await json<{ ok: boolean }>(res);
    assert.equal(body.ok, true);

    // Re-fetch file to confirm key is persisted
    const check = await fetch(
      `${url}/api/file?path=${encodeURIComponent(file)}`,
    );
    const f = await json<{ keys: Array<{ key: string; value: string }> }>(
      check,
    );
    const added = f.keys.find((k) => k.key === "NEW_KEY");
    assert.ok(added);
    assert.equal(added!.value, "newval");
  } finally {
    await close();
    cleanup(dir);
  }
});

test("PUT /api/key add: duplicate key returns 500", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: file,
        key: "FOO",
        value: "other",
        isNew: true,
      }),
    });
    assert.equal(res.status, 500);
  } finally {
    await close();
    cleanup(dir);
  }
});

test("PUT /api/key missing path/key returns 400", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "val" }),
    });
    assert.equal(res.status, 400);
    const body = await json<{ error: string }>(res);
    assert.ok(body.error.includes("required"));
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/key — update
// ---------------------------------------------------------------------------

test("PUT /api/key with isNew=false updates an existing key", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: file,
        key: "FOO",
        value: "updated",
        isNew: false,
      }),
    });
    assert.equal(res.status, 200);

    const check = await fetch(
      `${url}/api/file?path=${encodeURIComponent(file)}`,
    );
    const f = await json<{ keys: Array<{ key: string; value: string }> }>(
      check,
    );
    const k = f.keys.find((k) => k.key === "FOO");
    assert.equal(k!.value, "updated");
  } finally {
    await close();
    cleanup(dir);
  }
});

test("PUT /api/key update: nonexistent key returns 500", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: file,
        key: "MISSING",
        value: "val",
        isNew: false,
      }),
    });
    assert.equal(res.status, 500);
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/key
// ---------------------------------------------------------------------------

test("DELETE /api/key removes the key from the file", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, key: "FOO" }),
    });
    assert.equal(res.status, 200);
    const body = await json<{ ok: boolean }>(res);
    assert.equal(body.ok, true);

    const check = await fetch(
      `${url}/api/file?path=${encodeURIComponent(file)}`,
    );
    const f = await json<{ keys: Array<{ key: string }> }>(check);
    assert.ok(!f.keys.some((k) => k.key === "FOO"));
  } finally {
    await close();
    cleanup(dir);
  }
});

test("DELETE /api/key nonexistent key still returns 200 (idempotent)", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, key: "MISSING" }),
    });
    assert.equal(res.status, 200);
  } finally {
    await close();
    cleanup(dir);
  }
});

test("DELETE /api/key missing path/key returns 400", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/key`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/some/path" }),
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// POST /api/decrypt — plain value (no encryption needed)
// ---------------------------------------------------------------------------

test("POST /api/decrypt returns value as-is for plain (non-encrypted) key", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, key: "FOO" }),
    });
    assert.equal(res.status, 200);
    const body = await json<{ value: string }>(res);
    assert.equal(body.value, "bar");
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt returns 404 for unknown key", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, key: "MISSING" }),
    });
    assert.equal(res.status, 404);
    const body = await json<{ error: string }>(res);
    assert.ok(body.error.includes("not found"));
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt returns 404 for unknown file", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/nonexistent/.env", key: "FOO" }),
    });
    assert.equal(res.status, 404);
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt returns 403 when encrypted key has no private key", async () => {
  const { dir, file } = fixture();
  // Encrypt the file, then delete the keys file before the server starts
  encryptFile(file);
  rmSync(join(dir, ".env.keys"));

  const { url, close } = startTestServer(dir);
  try {
    const filesRes = await fetch(`${url}/api/files`);
    const files =
      await json<
        Array<{
          path: string;
          keys: Array<{ key: string; encrypted: boolean }>;
        }>
      >(filesRes);
    const envFile = files.find((f) => f.path === file)!;
    const encKey = envFile.keys.find((k) => k.encrypted);
    assert.ok(encKey, "should have at least one encrypted key");

    const res = await fetch(`${url}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, key: encKey!.key }),
    });
    assert.equal(res.status, 403);
    const body = await json<{ error: string }>(res);
    assert.ok(body.error.includes("Private key"));
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt missing path/key returns 400", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/some/path" }),
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// POST /api/decrypt-all
// ---------------------------------------------------------------------------

test("POST /api/decrypt-all returns map of key→value for plain file", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file }),
    });
    assert.equal(res.status, 200);
    const body = await json<{ values: Record<string, string> }>(res);
    assert.equal(body.values.FOO, "bar");
    assert.equal(body.values.BAZ, "qux");
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt-all decrypts encrypted values when private key available", async () => {
  const { dir, file } = fixture();
  encryptFile(file);
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file }),
    });
    assert.equal(res.status, 200);
    const body = await json<{ values: Record<string, string> }>(res);
    assert.equal(body.values.FOO, "bar");
    assert.equal(body.values.BAZ, "qux");
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt-all returns 400 when path missing", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
    cleanup(dir);
  }
});

test("POST /api/decrypt-all returns 404 for unknown file", async () => {
  const { dir } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    const res = await fetch(`${url}/api/decrypt-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/nonexistent/.env" }),
    });
    assert.equal(res.status, 404);
  } finally {
    await close();
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// State refresh after mutations
// ---------------------------------------------------------------------------

test("after PUT /api/key, GET /api/files reflects the change", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    await fetch(`${url}/api/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: file,
        key: "NEW",
        value: "added",
        isNew: true,
      }),
    });

    const res = await fetch(`${url}/api/files`);
    const files = await json<Array<{ keys: Array<{ key: string }> }>>(res);
    assert.ok(files[0]!.keys.some((k) => k.key === "NEW"));
  } finally {
    await close();
    cleanup(dir);
  }
});

test("after DELETE /api/key, GET /api/files reflects the change", async () => {
  const { dir, file } = fixture();
  const { url, close } = startTestServer(dir);
  try {
    await fetch(`${url}/api/key`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, key: "FOO" }),
    });

    const res = await fetch(`${url}/api/files`);
    const files = await json<Array<{ keys: Array<{ key: string }> }>>(res);
    assert.ok(!files[0]!.keys.some((k) => k.key === "FOO"));
  } finally {
    await close();
    cleanup(dir);
  }
});
