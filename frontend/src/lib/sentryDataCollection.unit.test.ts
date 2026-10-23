import { describe, expect, it } from "vitest";
import { SENTRY_DATA_COLLECTION } from "./sentryDataCollection";

// Every leaf must be off: false, an empty list, or zero lines of context.
function collectsSomething(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return value > 0;
  if (value && typeof value === "object") return Object.values(value).some(collectsSomething);
  return value !== false;
}

describe("SENTRY_DATA_COLLECTION", () => {
  it("switches off every category Sentry can collect", () => {
    for (const [key, value] of Object.entries(SENTRY_DATA_COLLECTION)) {
      expect(collectsSomething(value), key).toBe(false);
    }
  });

  it("never sends request or response bodies", () => {
    expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
  });
});
