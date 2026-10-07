import { describe, expect, it } from "vitest";
import { conjunctionFormatter } from "./listFormat";

describe("conjunctionFormatter", () => {
  it("joins names the way the language does", () => {
    expect(conjunctionFormatter("en").format(["Ada", "Ben", "Cas"])).toBe("Ada, Ben, and Cas");
    expect(conjunctionFormatter("nl").format(["Ada", "Ben"])).toBe("Ada en Ben");
  });

  it("reuses one formatter per language and falls back to English", () => {
    expect(conjunctionFormatter("nl-BE")).toBe(conjunctionFormatter("nl"));
    expect(conjunctionFormatter("de")).toBe(conjunctionFormatter("en"));
  });
});
