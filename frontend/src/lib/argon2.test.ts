import { describe, expect, it } from "vitest";

describe("argon2", () => {
  it("throws when argon2-browser global is not loaded", async () => {
    // Ensure self.argon2 is not set
    const prev = (self as unknown as Record<string, unknown>).argon2;
    delete (self as unknown as Record<string, unknown>).argon2;

    // Fresh import to avoid module cache from other tests
    const { default: argon2 } = await import("./argon2");

    expect(() => argon2.ArgonType).toThrow("argon2-browser not loaded yet");
    expect(() => argon2.hash({ pass: "test", salt: "salt" })).toThrow(
      "argon2-browser not loaded yet",
    );

    // Restore
    if (prev !== undefined) {
      (self as unknown as Record<string, unknown>).argon2 = prev;
    }
  });

  it("delegates to the global argon2 when loaded", async () => {
    const mockHash = { hash: new Uint8Array(), hashHex: "abc", encoded: "enc" };
    const mockArgon2 = {
      ArgonType: { Argon2d: 0 as const, Argon2i: 1 as const, Argon2id: 2 as const },
      hash: () => Promise.resolve(mockHash),
    };
    (self as unknown as Record<string, unknown>).argon2 = mockArgon2;

    const { default: argon2 } = await import("./argon2");

    expect(argon2.ArgonType).toEqual({ Argon2d: 0, Argon2i: 1, Argon2id: 2 });
    const result = await argon2.hash({ pass: "test", salt: "salt" });
    expect(result).toEqual(mockHash);

    delete (self as unknown as Record<string, unknown>).argon2;
  });
});
