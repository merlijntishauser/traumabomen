import { describe, expect, it } from "vitest";
import { htmlLangFor } from "./documentLanguage";

describe("htmlLangFor", () => {
  it("maps Dutch variants to nl", () => {
    expect(htmlLangFor("nl")).toBe("nl");
    expect(htmlLangFor("nl-NL")).toBe("nl");
    expect(htmlLangFor("NL-be")).toBe("nl");
  });

  it("maps everything else to en", () => {
    expect(htmlLangFor("en")).toBe("en");
    expect(htmlLangFor("en-GB")).toBe("en");
    expect(htmlLangFor("de")).toBe("en");
    expect(htmlLangFor(undefined)).toBe("en");
  });
});
