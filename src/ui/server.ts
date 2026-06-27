import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import getPort from "get-port";
import open from "open";
import { createRouter } from "./router.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDist = join(__dirname, "ui");

export async function startServer(cwd: string): Promise<void> {
  const port = await getPort();
  const app = express();
  app.use(express.json());
  app.use(createRouter(cwd));
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
