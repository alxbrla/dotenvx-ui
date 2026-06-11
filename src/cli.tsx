import React from "react";
import { render } from "ink";
import { scan } from "./core/scanner.js";
import { App } from "./tui/App.js";
import { ErrorBoundary } from "./tui/ErrorBoundary.js";
import { createRequire } from "node:module";
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const HELP = `
dotenvx-ui — terminal and web UI for dotenvx environment files

Usage:
  dotenvx-ui         Launch TUI
  dotenvx-ui ui      Launch web UI in browser

Options:
  -v, --version      Print version
  -h, --help         Show this help
`;

const commands: Record<string, () => void> = {
  "--version": () => { console.log(version); process.exit(0); },
  "-v":        () => { console.log(version); process.exit(0); },
  "--help":    () => { console.log(HELP); process.exit(0); },
  "-h":        () => { console.log(HELP); process.exit(0); },
  "ui":        runWebUI,
};

const [, , command] = process.argv;

if (command !== undefined && !(command in commands)) {
  console.error(`Unknown command: ${command}\nRun dotenvx-ui --help for usage.`);
  process.exit(1);
}

commands[command ?? ""]?.() ?? runTUI();

function runTUI() {
  const files = scan(process.cwd());
  if (files.length === 0) {
    console.error("No .env files found in this directory.");
    process.exit(1);
  }
  render(<ErrorBoundary><App files={files} /></ErrorBoundary>);
}

function runWebUI() {
  console.log("Web UI — coming soon");
  process.exit(0);
}
