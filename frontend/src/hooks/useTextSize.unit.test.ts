import { describe, expect, it } from "vitest";
import { parseTextSize } from "./useTextSize";

describe("parseTextSize", () => {
  it("accepts the three known sizes", () => {
    expect(parseTextSize("small")).toBe("small");
    expect(parseTextSize("normal")).toBe("normal");
    expect(parseTextSize("large")).toBe("large");
  });

  it("falls back to normal for missing or unknown values", () => {
    expect(parseTextSize(null)).toBe("normal");
    expect(parseTextSize("huge")).toBe("normal");
    expect(parseTextSize("")).toBe("normal");
  });
});
