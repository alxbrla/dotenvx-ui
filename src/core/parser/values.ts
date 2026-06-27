export function isEncryptedValue(value: string): boolean {
  return value.startsWith("encrypted:");
}

export function parseValue(
  rawValue: string,
  allLines: string[],
  nextLineIdx: number,
): { value: string; extraLines: string[] } {
  const trimmed = rawValue.trim();

  if (trimmed.startsWith('"')) {
    const inner = trimmed.slice(1);
    const closeIdx = findClosingQuote(inner);
    if (closeIdx !== -1) {
      return { value: unescape(inner.slice(0, closeIdx)), extraLines: [] };
    }
    // Real newlines inside quotes — consume until closing quote
    const valueLines: string[] = [inner];
    let idx = nextLineIdx;
    while (idx < allLines.length) {
      const continuation = allLines[idx]!;
      const close = findClosingQuote(continuation);
      if (close !== -1) {
        valueLines.push(continuation.slice(0, close));
        return {
          value: valueLines.join("\n"),
          extraLines: allLines.slice(nextLineIdx, idx + 1),
        };
      }
      valueLines.push(continuation);
      idx++;
    }
    return {
      value: valueLines.join("\n"),
      extraLines: allLines.slice(nextLineIdx, idx),
    };
  }

  if (trimmed.startsWith("'")) {
    const inner = trimmed.slice(1);
    const closeIdx = inner.indexOf("'");
    return {
      value: closeIdx !== -1 ? inner.slice(0, closeIdx) : inner,
      extraLines: [],
    };
  }

  // Unquoted — strip inline comment
  const commentIdx = trimmed.indexOf(" #");
  const bare = commentIdx !== -1 ? trimmed.slice(0, commentIdx) : trimmed;
  return { value: bare, extraLines: [] };
}

export function serializeKeyValue(key: string, value: string): string {
  if (value.includes("\n")) {
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\r/g, "\\r");
    return `${key}="${escaped}"`;
  }
  if (value === "" || /[\s#"'`]/.test(value)) {
    return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return `${key}=${value}`;
}

// Finds the index of the first unescaped closing double-quote in s
function findClosingQuote(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === '"') return i;
  }
  return -1;
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: local helper, not overriding global
function unescape(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"');
}
