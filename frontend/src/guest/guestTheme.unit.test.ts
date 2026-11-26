import { describe, expect, it } from "vitest";
import { readStoredTheme, THEME_STORAGE_KEY } from "./guestTheme";

function storageWith(value: string | null): () => Pick<Storage, "getItem"> {
  return () => ({ getItem: (key: string) => (key === THEME_STORAGE_KEY ? value : null) });
}

describe("readStoredTheme", () => {
  it("uses the light theme when the main app has it set", () => {
    expect(readStoredTheme(storageWith("light"))).toBe("light");
  });

  it("uses the dark theme when it is set, unset or unknown", () => {
    expect(readStoredTheme(storageWith("dark"))).toBe("dark");
    expect(readStoredTheme(storageWith(null))).toBe("dark");
    expect(readStoredTheme(storageWith("neon"))).toBe("dark");
  });

  it("falls back to dark when storage is missing or getItem throws", () => {
    expect(readStoredTheme(() => undefined)).toBe("dark");
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredTheme(() => throwing)).toBe("dark");
  });

  it("falls back to dark when reaching storage at all throws (site data blocked)", () => {
    expect(
      readStoredTheme(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }),
    ).toBe("dark");
  });
});
