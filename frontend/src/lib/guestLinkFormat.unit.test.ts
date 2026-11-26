import { describe, expect, it } from "vitest";
import { formatLinkDate, guestLanguageOf, guestLinkUrl } from "./guestLinkFormat";

describe("guestLinkUrl", () => {
  it("puts the secret in the fragment and nothing else in the URL", () => {
    expect(guestLinkUrl("https://traumatrees.org", "abc_-123")).toBe(
      "https://traumatrees.org/view#abc_-123",
    );
  });
});

describe("formatLinkDate", () => {
  const now = new Date("2026-11-26T12:00:00Z");

  it("leaves the year out within the current year", () => {
    expect(formatLinkDate("2026-12-02T10:00:00Z", "en", now)).toBe("December 2");
    expect(formatLinkDate("2026-12-02T10:00:00Z", "nl", now)).toBe("2 december");
  });

  it("shows the year when it is another one", () => {
    expect(formatLinkDate("2027-01-03T10:00:00Z", "en-US", now)).toBe("January 3, 2027");
    expect(formatLinkDate("2027-01-03T10:00:00Z", "nl", now)).toBe("3 januari 2027");
  });
});

describe("guestLanguageOf", () => {
  it.each([
    ["nl", "nl"],
    ["nl-BE", "nl"],
    ["en", "en"],
    ["en-US", "en"],
    ["de", "en"],
  ])("maps %s to %s", (input, expected) => {
    expect(guestLanguageOf(input)).toBe(expected);
  });
});
