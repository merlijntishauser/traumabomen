import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

const NOW = Date.parse("2026-07-05T12:00:00Z");

describe("formatRelativeTime", () => {
  it("formats days ago", () => {
    expect(formatRelativeTime("2026-07-02T12:00:00Z", "en", NOW)).toBe("3 days ago");
  });

  it("uses natural words when available", () => {
    expect(formatRelativeTime("2026-07-04T12:00:00Z", "en", NOW)).toBe("yesterday");
  });

  it("formats months and years", () => {
    expect(formatRelativeTime("2026-04-05T12:00:00Z", "en", NOW)).toBe("3 months ago");
    expect(formatRelativeTime("2024-07-05T12:00:00Z", "en", NOW)).toBe("2 years ago");
  });

  it("clamps fresh timestamps to the present", () => {
    expect(formatRelativeTime("2026-07-05T11:59:59Z", "en", NOW)).toBe("this minute");
  });

  it("speaks Dutch", () => {
    expect(formatRelativeTime("2026-07-02T12:00:00Z", "nl", NOW)).toBe("3 dagen geleden");
  });

  it("returns empty for malformed input", () => {
    expect(formatRelativeTime("not-a-date", "en", NOW)).toBe("");
  });
});
