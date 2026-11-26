import { describe, expect, it } from "vitest";
import { detectGuestLanguage, languageForHostname } from "./guestLanguage";

describe("languageForHostname", () => {
  it.each([
    ["traumabomen.nl", "nl"],
    ["www.traumabomen.nl", "nl"],
    ["traumatrees.org", "en"],
    ["www.traumatrees.org", "en"],
  ])("reads %s as %s", (hostname, expected) => {
    expect(languageForHostname(hostname)).toBe(expected);
  });

  it.each(["localhost", "nottraumabomen.nl", "traumabomen.nl.example.com"])(
    "implies nothing for %s",
    (hostname) => {
      expect(languageForHostname(hostname)).toBeUndefined();
    },
  );
});

describe("detectGuestLanguage", () => {
  it("prefers the host over the browser", () => {
    expect(detectGuestLanguage("www.traumabomen.nl", ["en-US"])).toBe("nl");
    expect(detectGuestLanguage("www.traumatrees.org", ["nl-NL"])).toBe("en");
  });

  it("takes the first supported browser language on other hosts", () => {
    expect(detectGuestLanguage("localhost", ["de-DE", "NL-be", "en"])).toBe("nl");
    expect(detectGuestLanguage("localhost", ["en-GB", "nl"])).toBe("en");
  });

  it("falls back to English", () => {
    expect(detectGuestLanguage("localhost", ["de-DE", "fr"])).toBe("en");
    expect(detectGuestLanguage("localhost", [])).toBe("en");
  });
});
