const [, , command] = process.argv;

if (command === "--version" || command === "-v") {
  console.log("0.1.0");
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log(`
dotenvx-ui — terminal and web UI for dotenvx environment files

Usage:
  dotenvx-ui         Launch TUI
  dotenvx-ui ui      Launch web UI in browser

Options:
  -v, --version      Print version
  -h, --help         Show this help
`);
  process.exit(0);
}

console.log("dotenvx-ui — coming soon");
