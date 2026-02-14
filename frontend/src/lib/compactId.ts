// Encode UUIDs as compact base62 strings for cleaner URLs.
// "03f28958-029f-4663-82e3-4de766986d28" -> "7BzR1k4a9P2mQ..." (22 chars)
// Fully reversible, no backend changes needed.

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(CHARS.length);

export function uuidToCompact(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  let num = BigInt("0x" + hex);
  if (num === 0n) return "0";
  const chars: string[] = [];
  while (num > 0n) {
    chars.push(CHARS[Number(num % BASE)]);
    num /= BASE;
  }
  return chars.reverse().join("");
}

export function compactToUuid(compact: string): string {
  let num = 0n;
  for (const ch of compact) {
    const idx = CHARS.indexOf(ch);
    if (idx === -1) throw new Error("Invalid compact ID character");
    num = num * BASE + BigInt(idx);
  }
  const hex = num.toString(16).padStart(32, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
