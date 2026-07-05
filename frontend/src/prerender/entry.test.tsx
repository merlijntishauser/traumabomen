import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fillPlaceholders, genogramPageMeta, injectRoot, renderGenogramPage } from "./entry";

// The real translation files: this test doubles as a guard that the keys the
// prerender depends on actually exist in both languages. Vitest runs from the
// frontend root, so cwd-relative resolution is stable (import.meta.url is
// rewritten by the transform and is not).
function loadTranslations(lang: "en" | "nl"): Record<string, string> {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `public/locales/${lang}/translation.json`), "utf8"),
  );
}

const resources = { en: loadTranslations("en"), nl: loadTranslations("nl") };

// React escapes apostrophes in rendered HTML text and attributes.
function esc(value: string): string {
  return value.replace(/'/g, "&#x27;");
}

describe("renderGenogramPage", () => {
  it("renders the English page with full content and structured data", () => {
    const html = renderGenogramPage("en", resources);

    expect(html).toContain(esc(resources.en["genogram.title"]));
    expect(html).toContain("What is a genogram?");
    expect(html).toContain(resources.en["genogram.howPrivacyTitle"]);
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain("https://www.traumatrees.org/genogram");
    expect(html).toContain('href="/genogram-maken"');
    expect(html).toContain('href="/register"');
  });

  it("renders the Dutch page in Dutch", () => {
    const html = renderGenogramPage("nl", resources);

    expect(html).toContain("Wat is een genogram?");
    expect(html).toContain(resources.nl["genogram.lede"]);
    expect(html).toContain("https://www.traumabomen.nl/genogram-maken");
    expect(html).toContain('href="/genogram"');
  });

  it("renders screenshots with alt text from the page language", () => {
    const html = renderGenogramPage("nl", resources);
    expect(html).toContain(`alt="${esc(resources.nl["genogram.figureTreeAlt"])}"`);
  });
});

describe("full prerender pipeline", () => {
  it("produces a document with baked head and body for the English page", () => {
    const template = [
      '<html lang="__OG_LANG__"><head><title>__OG_TITLE__</title>',
      '<meta name="description" content="__OG_DESC__" />',
      '<link rel="canonical" href="__OG_CANONICAL__" />',
      '</head><body><div id="root"></div></body></html>',
    ].join("");

    const meta = genogramPageMeta("en", resources.en);
    const html = renderGenogramPage("en", resources);
    const out = injectRoot(fillPlaceholders(template, meta), html);

    expect(out).toContain(`<title>${resources.en["genogram.title"]} | Traumatrees</title>`);
    expect(out).toContain('href="https://www.traumatrees.org/genogram"');
    expect(out).toContain("What is a genogram?");
    expect(out).not.toContain("__OG_");
    expect(out).not.toContain('<div id="root"></div>');
  });
});
