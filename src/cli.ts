import { scan } from "./core/scanner.js";

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
  "--version": () => { console.log("0.1.0"); process.exit(0); },
  "-v":        () => { console.log("0.1.0"); process.exit(0); },
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

  // Placeholder until Phase 6
  const encCount = files.filter((f) => f.encrypted).length;
  console.log(`\nFound ${files.length} env file${files.length === 1 ? "" : "s"}  (${encCount} encrypted)\n`);

  const byPkg = Map.groupBy(files, (f) => f.package);
  for (const [pkg, pkgFiles] of byPkg) {
    console.log(`  ${pkg}`);
    for (const f of pkgFiles) {
      const enc = f.encrypted ? " \x1b[33mencrypted\x1b[0m" : " plain";
      const lock = f.encrypted && !f.hasPublicKey ? " \x1b[90m(no public key)\x1b[0m" : "";
      console.log(`    ${f.environment.padEnd(14)}${enc}${lock}  ${f.relativePath}`);
    }
  }
  console.log("\nTUI coming in Phase 6.");
}

function runWebUI() {
  console.log("Web UI — coming soon");
  process.exit(0);
}
