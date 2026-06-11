# dotenvx-ui

A terminal UI for managing [dotenvx](https://dotenvx.com) environment files.

Browse, edit, copy, add, and delete keys across all your `.env*` files — with first-class support for dotenvx encrypted files.

```
npx dotenvx-ui
```

---

## Features

- **Scans your project automatically** — finds all `.env*` files, works in monorepos
- **Encrypted file support** — reveal, copy, and edit encrypted values without touching `.env.keys`
- **Diff view** — compare any two env files side by side
- **Keyboard-driven** — no mouse needed
- **Local-first** — no account, no cloud, no telemetry

---

## Usage

```bash
npx dotenvx-ui        # launch TUI in current directory
npx dotenvx-ui --help
npx dotenvx-ui --version
```

---

## Keyboard shortcuts

### Main view

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate files / keys |
| `Tab` | Switch between file list and key table |
| `Enter` | Edit selected key |
| `a` | Add new key |
| `D` | Delete selected key |
| `y` | Copy value to clipboard |
| `r` | Reveal / hide selected value |
| `R` | Reveal / hide all values |
| `e` | Encrypt or decrypt the entire file |
| `d` | Open diff view |
| `?` | Show help |
| `q` / `Esc` | Quit |

### Diff view

| Key | Action |
|-----|--------|
| `↑` `↓` | Pick file to compare |
| `Esc` / `q` | Close diff view |

---

## Encrypted files

dotenvx-ui works with [dotenvx encryption](https://dotenvx.com/encryption) out of the box.

- Encrypted values show as `••••••••••••••` by default
- Press `r` to decrypt and reveal a value on demand (requires the private key in your environment or `.env.keys`)
- Press `Enter` to edit — the form pre-fills with the decrypted plaintext and re-encrypts on save
- Press `e` to encrypt or decrypt an entire file

If the private key is not available, values stay locked and a `🔒` is shown.

---

## Requirements

- Node.js 22+
- [dotenvx](https://dotenvx.com) (for encrypted file features)

---

## License

MIT © [Alexandru Burla](https://github.com/alxbrla)
