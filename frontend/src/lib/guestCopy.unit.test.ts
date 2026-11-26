import { describe, expect, it } from "vitest";
import demoFixtureEn from "../fixtures/demo-tree-en.json";
import { buildDemoState } from "./buildDemoState";
import type { DemoFixture } from "./createDemoTree";
import {
  buildGuestCopy,
  GUEST_COPY_VERSION,
  type GuestCopy,
  GuestCopyError,
  type GuestCopyInput,
  guestCopyToState,
  parseGuestCopy,
  summarizeGuestCopy,
  toPaletteColor,
} from "./guestCopy";
import { PATTERN_COLORS } from "./patternColors";
import type { DecryptedPerson } from "./treeEntities";

const NOW = new Date("2026-11-26T12:00:00.000Z");

function demoState(): GuestCopyInput {
  return buildDemoState(demoFixtureEn as DemoFixture);
}

/** A copy as the guest page receives it: serialised, then parsed as JSON. */
function wire(copy: unknown): unknown {
  return JSON.parse(JSON.stringify(copy));
}

function demoCopy(): Record<string, unknown> & GuestCopy {
  return wire(buildGuestCopy(demoState(), NOW, "en")) as Record<string, unknown> & GuestCopy;
}

function expectRejected(raw: unknown) {
  expect(() => parseGuestCopy(raw)).toThrow(GuestCopyError);
}

describe("buildGuestCopy", () => {
  it("writes the version, publish time, language and tree name", () => {
    const copy = buildGuestCopy(demoState(), NOW, "nl");
    expect(copy.version).toBe(GUEST_COPY_VERSION);
    expect(copy.publishedAt).toBe("2026-11-26T12:00:00.000Z");
    expect(copy.language).toBe("nl");
    expect(copy.treeName).toBe(demoFixtureEn.treeName);
  });

  it("drops fields that are not in an entity's field list", () => {
    const state = demoState();
    const [first] = state.persons.values();
    state.persons.set(first.id, { ...first, secret: "do not publish" } as DecryptedPerson);
    const [rel] = state.relationships.values();
    state.relationships.set(rel.id, {
      ...rel,
      periods: [
        {
          start_year: 1980,
          end_year: null,
          status: rel.periods[0]?.status ?? "together",
          secret: "x",
        },
      ],
    } as typeof rel);

    const copy = buildGuestCopy(state, NOW, "en");
    expect(JSON.stringify(copy)).not.toContain("secret");
    expect(copy.persons.find((p) => p.id === first.id)).not.toHaveProperty("secret");
  });

  it("has no journal, whatever the input carries", () => {
    const input = {
      ...demoState(),
      journalEntries: new Map([
        ["j1", { id: "j1", text: "private reflection", linked_entities: [] }],
      ]),
    } as GuestCopyInput;
    const copy = buildGuestCopy(input, NOW, "en");
    expect(Object.keys(copy).sort()).toEqual(
      [
        "classifications",
        "events",
        "language",
        "lifeEvents",
        "patterns",
        "persons",
        "publishedAt",
        "relationships",
        "siblingGroups",
        "treeName",
        "turningPoints",
        "version",
      ].sort(),
    );
    expect(JSON.stringify(copy)).not.toContain("private reflection");
    expect(JSON.stringify(copy).toLowerCase()).not.toContain("journal");
  });

  it("fills a nullable field an old record lacks with null", () => {
    const state = demoState();
    const [first] = state.persons.values();
    const legacy: Partial<DecryptedPerson> = { ...first };
    delete legacy.birth_month;
    state.persons.set(first.id, legacy as DecryptedPerson);
    const copy = buildGuestCopy(state, NOW, "en");
    expect(copy.persons.find((p) => p.id === first.id)?.birth_month).toBeNull();
    expect(() => parseGuestCopy(wire(copy))).not.toThrow();
  });

  it("keeps a canvas position and leaves it out when there is none", () => {
    const state = demoState();
    const [first, second] = state.persons.values();
    state.persons.set(first.id, { ...first, position: { x: 10, y: -20.5 } });
    const copy = parseGuestCopy(wire(buildGuestCopy(state, NOW, "en")));
    expect(copy.persons.find((p) => p.id === first.id)?.position).toEqual({ x: 10, y: -20.5 });
    expect(copy.persons.find((p) => p.id === second.id)).not.toHaveProperty("position");
  });

  it("publishes every pattern in a palette colour", () => {
    const copy = buildGuestCopy(demoState(), NOW, "en");
    for (const pattern of copy.patterns) expect(PATTERN_COLORS).toContain(pattern.color);
  });

  it("produces a copy that passes parseGuestCopy", () => {
    expect(() => parseGuestCopy(demoCopy())).not.toThrow();
  });
});

describe("toPaletteColor", () => {
  it("keeps a palette colour, in the palette's own spelling", () => {
    expect(toPaletteColor("#818cf8")).toBe("#818cf8");
    expect(toPaletteColor("#F472B6")).toBe("#f472b6");
  });

  it("takes the nearest palette colour for another hex colour", () => {
    expect(toPaletteColor("#e06c75")).toBe("#f87171");
    expect(toPaletteColor("#61afef")).toBe("#38bdf8");
  });

  it("takes the first palette colour for anything that is not a hex colour", () => {
    expect(toPaletteColor("javascript:alert(1)")).toBe(PATTERN_COLORS[0]);
    expect(toPaletteColor("red")).toBe(PATTERN_COLORS[0]);
  });
});

describe("summarizeGuestCopy", () => {
  it("counts people, events of every kind and patterns", () => {
    const state = demoState();
    expect(summarizeGuestCopy(state)).toEqual({
      persons: state.persons.size,
      events: state.events.size + state.lifeEvents.size + state.turningPoints.size,
      patterns: state.patterns.size,
    });
  });
});

describe("guestCopyToState", () => {
  it("round-trips the demo tree through the wire format", () => {
    const state = demoState();
    const restored = guestCopyToState(parseGuestCopy(wire(buildGuestCopy(state, NOW, "en"))));
    // The demo's own pattern colours predate the palette; the copy carries
    // the nearest palette colour instead.
    for (const pattern of state.patterns.values()) pattern.color = toPaletteColor(pattern.color);
    expect(restored).toEqual(state);
  });
});

describe("parseGuestCopy", () => {
  it("rejects another version", () => {
    expectRejected({ ...demoCopy(), version: 2 });
  });

  it("rejects a value that is not an object", () => {
    expectRejected(null);
    expectRejected([]);
    expectRejected("copy");
  });

  it("rejects an unknown top-level key", () => {
    expectRejected({ ...demoCopy(), journalEntries: [] });
  });

  it("rejects a missing top-level key", () => {
    const copy: Partial<GuestCopy> = demoCopy();
    delete copy.patterns;
    expectRejected(copy);
  });

  it("rejects an unknown entity key", () => {
    const copy = demoCopy();
    copy.persons[0] = { ...copy.persons[0], extra: "x" } as DecryptedPerson;
    expectRejected(copy);
  });

  it("rejects an unknown key in a nested object", () => {
    const copy = demoCopy();
    copy.patterns[0].linked_entities[0] = {
      ...copy.patterns[0].linked_entities[0],
      extra: 1,
    } as (typeof copy.patterns)[0]["linked_entities"][0];
    expectRejected(copy);
  });

  it("rejects a colour outside the pattern palette", () => {
    const copy = demoCopy();
    copy.patterns[0].color = "javascript:alert(1)";
    expectRejected(copy);
    copy.patterns[0].color = "url(https://example.com/x)";
    expectRejected(copy);
  });

  it("accepts a palette colour in any case", () => {
    const copy = demoCopy();
    copy.patterns[0].color = copy.patterns[0].color.toUpperCase();
    expect(() => parseGuestCopy(copy)).not.toThrow();
  });

  it("rejects an unknown category", () => {
    const copy = demoCopy();
    (copy.events[0] as { category: string }).category = "unknown";
    expectRejected(copy);
  });

  it("rejects an unknown relationship type, status, gender and DSM key", () => {
    const cases: ((c: GuestCopy) => void)[] = [
      (c) => {
        (c.relationships[0] as { type: string }).type = "enemy";
      },
      (c) => {
        (c.classifications[0] as { status: string }).status = "rumoured";
      },
      (c) => {
        c.persons[0].gender = "<b>";
      },
      (c) => {
        c.classifications[0].dsm_category = "made_up";
      },
      (c) => {
        c.classifications[0].dsm_subcategory = "adhd_but_wrong";
      },
    ];
    for (const mutate of cases) {
      const copy = demoCopy();
      mutate(copy);
      expectRejected(copy);
    }
  });

  it("rejects a subcategory that belongs to another DSM category", () => {
    const copy = demoCopy();
    copy.classifications[0].dsm_category = "eating";
    copy.classifications[0].dsm_subcategory = "adhd";
    expectRejected(copy);
  });

  it("rejects a dangling person reference", () => {
    const copy = demoCopy();
    copy.events[0].person_ids = ["nobody"];
    expectRejected(copy);
  });

  it("rejects dangling references in relationships, patterns and sibling groups", () => {
    const cases: ((c: GuestCopy) => void)[] = [
      (c) => {
        c.relationships[0].target_person_id = "nobody";
      },
      (c) => {
        c.patterns[0].person_ids = ["nobody"];
      },
      (c) => {
        c.patterns[0].linked_entities = [{ entity_type: "trauma_event", entity_id: "nothing" }];
      },
      (c) => {
        c.siblingGroups.push({ id: "sg-new", person_ids: ["nobody"], members: [] });
      },
    ];
    for (const mutate of cases) {
      const copy = demoCopy();
      mutate(copy);
      expectRejected(copy);
    }
  });

  it("rejects a linked entity that points at the wrong kind", () => {
    const copy = demoCopy();
    copy.patterns[0].linked_entities = [
      { entity_type: "classification", entity_id: copy.events[0].id },
    ];
    expectRejected(copy);
  });

  it("rejects duplicate ids within an entity type", () => {
    const copy = demoCopy();
    copy.persons.push({ ...copy.persons[0] });
    expectRejected(copy);
  });

  it("rejects an over-long string", () => {
    const longName = demoCopy();
    longName.persons[0].name = "a".repeat(501);
    expectRejected(longName);

    const longNotes = demoCopy();
    longNotes.persons[0].notes = "a".repeat(20_001);
    expectRejected(longNotes);

    const longId = demoCopy();
    longId.treeName = "a".repeat(501);
    expectRejected(longId);
  });

  it("accepts strings at their limits", () => {
    const copy = demoCopy();
    copy.persons[0].name = "a".repeat(500);
    copy.persons[0].notes = "a".repeat(20_000);
    expect(() => parseGuestCopy(copy)).not.toThrow();
  });

  it("rejects an over-long or empty id", () => {
    const copy = demoCopy();
    copy.lifeEvents[0].id = "x".repeat(65);
    expectRejected(copy);
    copy.lifeEvents[0].id = "";
    expectRejected(copy);
  });

  it("rejects a number where a string belongs", () => {
    const copy = demoCopy();
    (copy.persons[0] as unknown as { name: number }).name = 42;
    expectRejected(copy);
  });

  it("rejects a string where a number belongs", () => {
    const copy = demoCopy();
    (copy.persons[0] as unknown as { birth_year: string }).birth_year = "1950";
    expectRejected(copy);
  });

  it("rejects years outside 0..3000 and fractional years", () => {
    for (const bad of [-1, 3001, 1950.5, Number.MAX_SAFE_INTEGER]) {
      const copy = demoCopy();
      copy.persons[0].birth_year = bad;
      expectRejected(copy);
    }
  });

  it("rejects a missing required field", () => {
    const copy = demoCopy();
    const person: Partial<DecryptedPerson> = { ...copy.persons[0] };
    delete person.gender;
    copy.persons[0] = person as DecryptedPerson;
    expectRejected(copy);
  });

  it("rejects more than 5000 entities of one type", () => {
    const copy = demoCopy();
    const person = copy.persons[0];
    copy.persons = Array.from({ length: 5001 }, (_, i) => ({ ...person, id: `p${i}` }));
    copy.relationships = [];
    copy.events = [];
    copy.lifeEvents = [];
    copy.turningPoints = [];
    copy.classifications = [];
    copy.patterns = [];
    copy.siblingGroups = [];
    expectRejected(copy);
  });

  it("rejects __proto__ keys", () => {
    const text = JSON.stringify(demoCopy());
    expectRejected(
      JSON.parse(text.replace('{"version":1', '{"__proto__":{"polluted":true},"version":1')),
    );
    expectRejected(
      JSON.parse(text.replace('"persons":[{', '"persons":[{"__proto__":{"polluted":true},')),
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects a malformed publish time", () => {
    expectRejected({ ...demoCopy(), publishedAt: "yesterday" });
  });

  it("rejects an unsupported language", () => {
    expectRejected({ ...demoCopy(), language: "de" });
  });

  it("returns fresh objects that carry no extra keys", () => {
    const parsed = parseGuestCopy(demoCopy());
    expect(Object.getPrototypeOf(parsed.persons[0])).toBe(Object.prototype);
  });
});
