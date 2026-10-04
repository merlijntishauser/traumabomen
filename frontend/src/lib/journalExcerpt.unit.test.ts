import { describe, expect, it } from "vitest";
import { entryExcerpt, formatEntryDate, markdownToPlain, wasEditedLater } from "./journalExcerpt";

describe("markdownToPlain", () => {
  it("drops headings, quotes, list markers and emphasis", () => {
    expect(
      markdownToPlain("# The silver\n> She never said why\n- **tulip** bulbs\n1. _once_"),
    ).toBe("The silver She never said why tulip bulbs once");
  });

  it("keeps the text of links and images", () => {
    expect(markdownToPlain("See [Oma](https://example.org) and ![a photo](x.png)")).toBe(
      "See Oma and a photo",
    );
  });

  it("leaves lines that only look like markers alone", () => {
    expect(markdownToPlain("1984 was the year\n#hashtag\n3.5 stars")).toBe(
      "1984 was the year #hashtag 3.5 stars",
    );
  });

  it("drops a marker that stands alone on a line", () => {
    expect(markdownToPlain("-\n>\nText")).toBe("Text");
  });

  it("leaves brackets that are not links", () => {
    expect(markdownToPlain("[sic] and [open (paren")).toBe("[sic] and [open (paren");
  });

  it("collapses whitespace", () => {
    expect(markdownToPlain("  a\n\n\tb  ")).toBe("a b");
  });
});

describe("entryExcerpt", () => {
  it("returns short entries whole", () => {
    expect(entryExcerpt("Nobody said her name.")).toBe("Nobody said her name.");
  });

  it("cuts long entries at a word boundary with an ellipsis", () => {
    const text = "Grandma only told me about the hunger winter once, and I keep thinking about it";
    expect(entryExcerpt(text, 40)).toBe("Grandma only told me about the hunger…");
  });

  it("cuts mid-word when no space falls late enough", () => {
    expect(entryExcerpt("abcdefghijklmnopqrstuvwxyz", 10)).toBe("abcdefghij…");
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(entryExcerpt("one two three, four five six seven", 15)).toBe("one two three…");
  });
});

describe("formatEntryDate", () => {
  it("formats a long date in the given language", () => {
    expect(formatEntryDate("2026-09-12T10:00:00Z", "en-GB")).toBe("12 September 2026");
    expect(formatEntryDate("2026-09-12T10:00:00Z", "nl")).toBe("12 september 2026");
  });

  it("returns nothing for an unreadable date", () => {
    expect(formatEntryDate("not a date", "en")).toBe("");
  });
});

describe("wasEditedLater", () => {
  it("is true when edited on a later day", () => {
    expect(wasEditedLater("2026-09-01T10:00:00Z", "2026-09-03T10:00:00Z")).toBe(true);
  });

  it("is false for edits on the same day", () => {
    expect(wasEditedLater("2026-09-01T08:00:00", "2026-09-01T18:00:00")).toBe(false);
  });

  it("is false for unreadable dates", () => {
    expect(wasEditedLater("x", "2026-09-01T10:00:00Z")).toBe(false);
  });
});
