/**
 * Plain-text glimpses of journal entries for the margin of earlier entries.
 * Entries are markdown; the margin shows a calm line of prose, not syntax.
 */

const DEFAULT_EXCERPT_LENGTH = 140;

const LIST_BULLETS = new Set(["-", "*", "+"]);
const TRAILING_PUNCTUATION = new Set([" ", ".", ",", ";", ":"]);

/** Strip a heading, quote, bullet or numbered-list marker from the start of a line. */
function stripLineMarker(line: string): string {
  const text = line.trimStart();
  let i = 0;
  if (text[0] === "#") {
    while (text[i] === "#") i++;
  } else if (text[0] === ">" || LIST_BULLETS.has(text[0])) {
    i = 1;
  } else {
    while (i < text.length && text[i] >= "0" && text[i] <= "9") i++;
    if (i === 0 || (text[i] !== "." && text[i] !== ")")) return text;
    i++;
  }
  return text[i] === " " || text[i] === "\t" || i === text.length
    ? text.slice(i).trimStart()
    : text;
}

/** Replace `[text](url)` and `![alt](src)` with their text, without a backtracking regex. */
function stripLinks(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("[", i);
    if (open === -1) break;
    const close = text.indexOf("]", open + 1);
    const urlEnd = close === -1 || text[close + 1] !== "(" ? -1 : text.indexOf(")", close + 2);
    if (urlEnd === -1) {
      out += text.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    const start = open > 0 && text[open - 1] === "!" ? open - 1 : open;
    out += text.slice(i, start) + text.slice(open + 1, close);
    i = urlEnd + 1;
  }
  return out + text.slice(i);
}

/** Markdown reduced to plain prose: links keep their text, markers and emphasis go. */
export function markdownToPlain(text: string): string {
  return stripLinks(text.split("\n").map(stripLineMarker).join(" "))
    .replace(/\*\*|__|\*|_|`|~~/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The opening of an entry, cut at a word boundary with an ellipsis when long. */
export function entryExcerpt(text: string, maxLength = DEFAULT_EXCERPT_LENGTH): string {
  const plain = markdownToPlain(text);
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  let base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  while (base.length > 0 && TRAILING_PUNCTUATION.has(base[base.length - 1])) {
    base = base.slice(0, -1);
  }
  return `${base}…`;
}

/** "12 September 2026" in the reader's language. */
export function formatEntryDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

/** Whether an entry was edited on a later day than it was written. */
export function wasEditedLater(createdAt: string, updatedAt: string): boolean {
  const created = new Date(createdAt);
  const updated = new Date(updatedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false;
  return updated.toDateString() !== created.toDateString() && updated > created;
}
