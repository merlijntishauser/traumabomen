import { describe, expect, it } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import type { JournalLinkedRef } from "../types/domain";
import { CHIP_COLORS, getChipColor, resolveChipLabel } from "./journalChips";

const t = (key: string) => key;

const emptyMaps = {
  persons: new Map<string, DecryptedPerson>(),
  events: new Map<string, DecryptedEvent>(),
  lifeEvents: new Map<string, DecryptedLifeEvent>(),
  turningPoints: new Map<string, DecryptedTurningPoint>(),
  classifications: new Map<string, DecryptedClassification>(),
  patterns: new Map<string, DecryptedPattern>(),
};

function resolve(ref: JournalLinkedRef, overrides: Partial<typeof emptyMaps> = {}): string {
  const maps = { ...emptyMaps, ...overrides };
  return resolveChipLabel(
    ref,
    t,
    maps.persons,
    maps.events,
    maps.lifeEvents,
    maps.turningPoints,
    maps.classifications,
    maps.patterns,
  );
}

describe("resolveChipLabel", () => {
  it("resolves person name", () => {
    const persons = new Map([["p1", { id: "p1", name: "Alice" } as DecryptedPerson]]);
    expect(resolve({ entity_type: "person", entity_id: "p1" }, { persons })).toBe("Alice");
  });

  it("falls back to id when person not found", () => {
    expect(resolve({ entity_type: "person", entity_id: "p1" })).toBe("p1");
  });

  it("resolves trauma event title", () => {
    const events = new Map([["e1", { id: "e1", title: "Loss" } as DecryptedEvent]]);
    expect(resolve({ entity_type: "trauma_event", entity_id: "e1" }, { events })).toBe("Loss");
  });

  it("falls back to id when trauma event not found", () => {
    expect(resolve({ entity_type: "trauma_event", entity_id: "e1" })).toBe("e1");
  });

  it("resolves life event title", () => {
    const lifeEvents = new Map([["le1", { id: "le1", title: "Graduation" } as DecryptedLifeEvent]]);
    expect(resolve({ entity_type: "life_event", entity_id: "le1" }, { lifeEvents })).toBe(
      "Graduation",
    );
  });

  it("falls back to id when life event not found", () => {
    expect(resolve({ entity_type: "life_event", entity_id: "le1" })).toBe("le1");
  });

  it("resolves turning point title", () => {
    const turningPoints = new Map([
      ["tp1", { id: "tp1", title: "Recovery" } as DecryptedTurningPoint],
    ]);
    expect(resolve({ entity_type: "turning_point", entity_id: "tp1" }, { turningPoints })).toBe(
      "Recovery",
    );
  });

  it("falls back to id when turning point not found", () => {
    expect(resolve({ entity_type: "turning_point", entity_id: "tp1" })).toBe("tp1");
  });

  it("resolves classification with subcategory", () => {
    const classifications = new Map([
      [
        "c1",
        { id: "c1", dsm_category: "mood", dsm_subcategory: "bipolar" } as DecryptedClassification,
      ],
    ]);
    expect(resolve({ entity_type: "classification", entity_id: "c1" }, { classifications })).toBe(
      "dsm.sub.bipolar",
    );
  });

  it("resolves classification without subcategory", () => {
    const classifications = new Map([
      ["c1", { id: "c1", dsm_category: "mood", dsm_subcategory: null } as DecryptedClassification],
    ]);
    expect(resolve({ entity_type: "classification", entity_id: "c1" }, { classifications })).toBe(
      "dsm.mood",
    );
  });

  it("falls back to id when classification not found", () => {
    expect(resolve({ entity_type: "classification", entity_id: "c1" })).toBe("c1");
  });

  it("resolves pattern name", () => {
    const patterns = new Map([
      ["pat1", { id: "pat1", name: "Addiction cycle" } as DecryptedPattern],
    ]);
    expect(resolve({ entity_type: "pattern", entity_id: "pat1" }, { patterns })).toBe(
      "Addiction cycle",
    );
  });

  it("falls back to id when pattern not found", () => {
    expect(resolve({ entity_type: "pattern", entity_id: "pat1" })).toBe("pat1");
  });
});

describe("getChipColor", () => {
  const emptyPatterns = new Map<string, DecryptedPattern>();

  it("returns accent color for person", () => {
    expect(getChipColor({ entity_type: "person", entity_id: "p1" }, emptyPatterns)).toBe(
      CHIP_COLORS.person,
    );
  });

  it("returns red for trauma event", () => {
    expect(getChipColor({ entity_type: "trauma_event", entity_id: "e1" }, emptyPatterns)).toBe(
      CHIP_COLORS.trauma_event,
    );
  });

  it("returns blue for life event", () => {
    expect(getChipColor({ entity_type: "life_event", entity_id: "le1" }, emptyPatterns)).toBe(
      CHIP_COLORS.life_event,
    );
  });

  it("returns green for turning point", () => {
    expect(getChipColor({ entity_type: "turning_point", entity_id: "tp1" }, emptyPatterns)).toBe(
      CHIP_COLORS.turning_point,
    );
  });

  it("returns amber for classification", () => {
    expect(getChipColor({ entity_type: "classification", entity_id: "c1" }, emptyPatterns)).toBe(
      CHIP_COLORS.classification,
    );
  });

  it("returns pattern's own color when found", () => {
    const patterns = new Map([["pat1", { id: "pat1", color: "#ff00ff" } as DecryptedPattern]]);
    expect(getChipColor({ entity_type: "pattern", entity_id: "pat1" }, patterns)).toBe("#ff00ff");
  });

  it("returns default accent when pattern not found", () => {
    expect(getChipColor({ entity_type: "pattern", entity_id: "pat1" }, emptyPatterns)).toBe(
      CHIP_COLORS.pattern,
    );
  });
});
