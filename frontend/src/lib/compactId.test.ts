import { describe, it, expect } from "vitest";
import { uuidToCompact, compactToUuid, isUuid } from "./compactId";

describe("compactId", () => {
  const uuid = "03f28958-029f-4663-82e3-4de766986d28";

  it("round-trips a UUID", () => {
    const compact = uuidToCompact(uuid);
    expect(compactToUuid(compact)).toBe(uuid);
  });

  it("produces a shorter string than UUID", () => {
    const compact = uuidToCompact(uuid);
    expect(compact.length).toBeLessThan(uuid.length);
  });

  it("only contains alphanumeric characters", () => {
    const compact = uuidToCompact(uuid);
    expect(compact).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("round-trips the zero UUID", () => {
    const zero = "00000000-0000-0000-0000-000000000000";
    expect(compactToUuid(uuidToCompact(zero))).toBe(zero);
  });

  it("round-trips the max UUID", () => {
    const max = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    expect(compactToUuid(uuidToCompact(max))).toBe(max);
  });

  it("isUuid detects UUIDs", () => {
    expect(isUuid(uuid)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(uuidToCompact(uuid))).toBe(false);
  });
});
