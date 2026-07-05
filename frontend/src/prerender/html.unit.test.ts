import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  fillPlaceholders,
  genogramJsonLd,
  genogramPageMeta,
  injectJsonLd,
  injectRoot,
  type PageMeta,
} from "./html";

const TRANSLATIONS = {
  "app.title": "Traumatrees",
  "genogram.title": "A genogram maker that keeps your family's story private",
  "genogram.metaDescription": "What a genogram is & how to make one.",
};

const TEMPLATE = [
  '<html lang="__OG_LANG__"><head>',
  "<title>__OG_TITLE__</title>",
  '<meta name="description" content="__OG_DESC__" />',
  '<link rel="canonical" href="__OG_CANONICAL__" />',
  '<link rel="alternate" hreflang="en" href="__OG_ALT_EN__" />',
  '<link rel="alternate" hreflang="nl" href="__OG_ALT_NL__" />',
  '<link rel="alternate" hreflang="x-default" href="__OG_ALT_EN__" />',
  '<meta property="og:title" content="__OG_TITLE__" />',
  '<meta property="og:image" content="__OG_ORIGIN__/images/og-card.jpg" />',
  '<meta property="og:locale" content="__OG_LOCALE__" />',
  '</head><body><div id="root"></div></body></html>',
].join("\n");

describe("escapeHtml", () => {
  it("escapes the four HTML-significant characters", () => {
    expect(escapeHtml('a & b < c > d " e')).toBe("a &amp; b &lt; c &gt; d &quot; e");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("genogram maken, gratis")).toBe("genogram maken, gratis");
  });
});

describe("genogramPageMeta", () => {
  it("composes the English page head values", () => {
    const meta = genogramPageMeta("en", TRANSLATIONS);
    expect(meta.canonical).toBe("https://www.traumatrees.org/genogram");
    expect(meta.origin).toBe("https://www.traumatrees.org");
    expect(meta.locale).toBe("en_US");
    expect(meta.title).toBe(
      "A genogram maker that keeps your family's story private | Traumatrees",
    );
    expect(meta.description).toBe(TRANSLATIONS["genogram.metaDescription"]);
  });

  it("points the Dutch page at the Dutch domain and path", () => {
    const meta = genogramPageMeta("nl", TRANSLATIONS);
    expect(meta.canonical).toBe("https://www.traumabomen.nl/genogram-maken");
    expect(meta.locale).toBe("nl_NL");
  });
});

describe("fillPlaceholders", () => {
  const meta: PageMeta = genogramPageMeta("en", TRANSLATIONS);
  const filled = fillPlaceholders(TEMPLATE, meta);

  it("replaces every placeholder occurrence", () => {
    expect(filled).not.toContain("__OG_");
  });

  it("writes the canonical and the cross-path hreflang pair", () => {
    expect(filled).toContain('href="https://www.traumatrees.org/genogram"');
    expect(filled).toContain(
      '<link rel="alternate" hreflang="nl" href="https://www.traumabomen.nl/genogram-maken" />',
    );
    expect(filled).toContain(
      '<link rel="alternate" hreflang="x-default" href="https://www.traumatrees.org/genogram" />',
    );
  });

  it("escapes meta values for attribute contexts", () => {
    expect(filled).toContain("What a genogram is &amp; how to make one.");
    expect(filled).not.toContain('content="What a genogram is & how');
  });

  it("keeps the og:image on the page's own origin", () => {
    expect(filled).toContain(
      '<meta property="og:image" content="https://www.traumatrees.org/images/og-card.jpg" />',
    );
  });
});

describe("genogramJsonLd", () => {
  const t = (key: string) => TRANSLATIONS[key as keyof typeof TRANSLATIONS] ?? key;

  it("builds SoftwareApplication data with the language canonical", () => {
    const data = JSON.parse(genogramJsonLd("en", t));
    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data.url).toBe("https://www.traumatrees.org/genogram");
    expect(data.offers.price).toBe("0");
    expect(data.inLanguage).toBe("en");
    expect(data.name).toBe("Traumatrees");
  });

  it("uses the Dutch canonical for the Dutch page", () => {
    const data = JSON.parse(genogramJsonLd("nl", t));
    expect(data.url).toBe("https://www.traumabomen.nl/genogram-maken");
    expect(data.inLanguage).toBe("nl");
  });

  it("escapes angle brackets so the script element cannot be closed early", () => {
    const raw = genogramJsonLd("en", (key) =>
      key === "genogram.metaDescription" ? "</script><b>x</b>" : "y",
    );
    expect(raw).not.toContain("</script>");
    expect(JSON.parse(raw).description).toBe("</script><b>x</b>");
  });
});

describe("injectJsonLd", () => {
  it("injects a tagged data block before the closing head tag", () => {
    const out = injectJsonLd("<head><title>t</title></head><body></body>", '{"a":1}');
    expect(out).toBe(
      '<head><title>t</title><script type="application/ld+json" data-prerender="true">{"a":1}</script></head><body></body>',
    );
  });

  it("throws when the head close tag is missing", () => {
    expect(() => injectJsonLd("<body></body>", "{}")).toThrow(/could not find/);
  });
});

describe("injectRoot", () => {
  it("injects markup into the empty root element", () => {
    const out = injectRoot(TEMPLATE, "<main>hello</main>");
    expect(out).toContain('<div id="root"><main>hello</main></div>');
  });

  it("throws when the root marker is missing", () => {
    expect(() => injectRoot("<body></body>", "<p>x</p>")).toThrow(/could not find/);
  });
});
