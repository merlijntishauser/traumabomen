import { describe, expect, it } from "vitest";
import { buildTreeMetaLine } from "./treeListMeta";

const t = (key: string, opts?: Record<string, unknown>) =>
  opts?.count !== undefined
    ? `${key}:${opts.count}`
    : opts?.time !== undefined
      ? `${key}:${opts.time}`
      : key;

const NOW_ISO = new Date().toISOString();

describe("buildTreeMetaLine", () => {
  it("lists counts joined with middots and appends the tended time", () => {
    const line = buildTreeMetaLine(
      { person_count: 4, moment_count: 12, pattern_count: 2, updated_at: NOW_ISO },
      t,
      "en",
    );
    expect(line).toContain("tree.meta.people:4");
    expect(line).toContain("tree.meta.moments:12");
    expect(line).toContain("tree.meta.patterns:2");
    expect(line).toContain("tree.meta.updated:");
    expect(line.split(" · ")).toHaveLength(4);
  });

  it("hides zero counts", () => {
    const line = buildTreeMetaLine(
      { person_count: 1, moment_count: 0, pattern_count: 0, updated_at: NOW_ISO },
      t,
      "en",
    );
    expect(line).toContain("tree.meta.people:1");
    expect(line).not.toContain("moments");
    expect(line).not.toContain("patterns");
  });

  it("says a fresh tree has not started yet", () => {
    const line = buildTreeMetaLine(
      { person_count: 0, moment_count: 0, pattern_count: 0, updated_at: NOW_ISO },
      t,
      "en",
    );
    expect(line).toContain("tree.meta.empty");
  });

  it("drops the time part for malformed timestamps", () => {
    const line = buildTreeMetaLine(
      { person_count: 1, moment_count: 0, pattern_count: 0, updated_at: "bad" },
      t,
      "en",
    );
    expect(line).toBe("tree.meta.people:1");
  });
});
