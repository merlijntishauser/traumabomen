import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoFixture } from "./createDemoTree";
import { buildIdMap, buildSyncRequest, createDemoTree } from "./createDemoTree";

vi.mock("./api", () => ({
  createTree: vi.fn().mockResolvedValue({
    id: "new-tree-id",
    encrypted_data: "enc",
    is_demo: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  }),
  syncTree: vi.fn().mockResolvedValue({}),
  createLifeEvent: vi.fn().mockResolvedValue({}),
  createTurningPoint: vi.fn().mockResolvedValue({}),
}));

const FIXTURE: DemoFixture = {
  treeName: "Demo tree",
  persons: [
    {
      id: "demo-p1",
      name: "Alice",
      birth_year: 1950,
      death_year: null,
      gender: "female",
      is_adopted: false,
      notes: "",
    },
    {
      id: "demo-p2",
      name: "Bob",
      birth_year: 1948,
      death_year: 2020,
      gender: "male",
      is_adopted: false,
      notes: "",
    },
  ],
  relationships: [
    {
      id: "demo-r1",
      source_person_id: "demo-p1",
      target_person_id: "demo-p2",
      type: "partner",
      periods: [{ start_year: 1970, end_year: null, status: "married" }],
    },
  ],
  events: [
    {
      id: "demo-e1",
      person_ids: ["demo-p1"],
      title: "Loss",
      description: "A loss event",
      category: "loss",
      approximate_date: "1980",
      severity: 5,
      tags: [],
    },
  ],
  lifeEvents: [
    {
      id: "demo-le1",
      person_ids: ["demo-p1", "demo-p2"],
      title: "Marriage",
      description: "Got married",
      category: "family",
      approximate_date: "1970",
      impact: 7,
      tags: [],
    },
  ],
  turningPoints: [
    {
      id: "demo-tp1",
      person_ids: ["demo-p1"],
      title: "Sought therapy",
      description: "Began therapy",
      category: "cycle_breaking",
      approximate_date: "1990",
      significance: 8,
      tags: [],
    },
  ],
  classifications: [
    {
      id: "demo-c1",
      person_ids: ["demo-p2"],
      dsm_category: "substance",
      dsm_subcategory: "alcohol_use",
      status: "diagnosed",
      diagnosis_year: 1985,
      periods: [{ start_year: 1980, end_year: 2020 }],
      notes: "test",
    },
  ],
  patterns: [
    {
      id: "demo-pat1",
      name: "Pattern 1",
      description: "A pattern",
      color: "#e06c75",
      person_ids: ["demo-p1", "demo-p2"],
      linked_entities: [
        { entity_type: "event", entity_id: "demo-e1" },
        { entity_type: "classification", entity_id: "demo-c1" },
      ],
    },
  ],
};

// Stable UUID generator for tests
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => {
    uuidCounter += 1;
    return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, "0")}`;
  },
});

describe("buildIdMap", () => {
  it("generates a UUID for every fixture entity", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);

    // 2 persons + 1 relationship + 1 event + 1 lifeEvent + 1 turningPoint + 1 classification + 1 pattern = 8
    expect(idMap.size).toBe(8);

    expect(idMap.has("demo-p1")).toBe(true);
    expect(idMap.has("demo-p2")).toBe(true);
    expect(idMap.has("demo-r1")).toBe(true);
    expect(idMap.has("demo-e1")).toBe(true);
    expect(idMap.has("demo-le1")).toBe(true);
    expect(idMap.has("demo-tp1")).toBe(true);
    expect(idMap.has("demo-c1")).toBe(true);
    expect(idMap.has("demo-pat1")).toBe(true);
  });

  it("generates unique UUIDs for each entity", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);
    const uuids = [...idMap.values()];
    expect(new Set(uuids).size).toBe(uuids.length);
  });
});

describe("buildSyncRequest", () => {
  it("remaps person IDs in relationships", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);

    const encrypted = new Map<string, string>();
    for (const [key] of idMap) {
      encrypted.set(key, `encrypted-${key}`);
    }

    const sync = buildSyncRequest(FIXTURE, idMap, encrypted);

    expect(sync.relationships_create).toHaveLength(1);
    const rel = sync.relationships_create![0];
    expect(rel.source_person_id).toBe(idMap.get("demo-p1"));
    expect(rel.target_person_id).toBe(idMap.get("demo-p2"));
  });

  it("remaps person IDs in events", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);

    const encrypted = new Map<string, string>();
    for (const [key] of idMap) {
      encrypted.set(key, `encrypted-${key}`);
    }

    const sync = buildSyncRequest(FIXTURE, idMap, encrypted);

    expect(sync.events_create).toHaveLength(1);
    const event = sync.events_create![0];
    expect(event.person_ids).toEqual([idMap.get("demo-p1")]);
  });

  it("uses encrypted data for each entity", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);

    const encrypted = new Map<string, string>();
    for (const [key] of idMap) {
      encrypted.set(key, `encrypted-${key}`);
    }

    const sync = buildSyncRequest(FIXTURE, idMap, encrypted);

    expect(sync.persons_create![0].encrypted_data).toBe("encrypted-demo-p1");
    expect(sync.persons_create![1].encrypted_data).toBe("encrypted-demo-p2");
    expect(sync.relationships_create![0].encrypted_data).toBe("encrypted-demo-r1");
    expect(sync.events_create![0].encrypted_data).toBe("encrypted-demo-e1");
    expect(sync.classifications_create![0].encrypted_data).toBe("encrypted-demo-c1");
    expect(sync.patterns_create![0].encrypted_data).toBe("encrypted-demo-pat1");
  });

  it("does not include life events in sync request", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);

    const encrypted = new Map<string, string>();
    for (const [key] of idMap) {
      encrypted.set(key, `encrypted-${key}`);
    }

    const sync = buildSyncRequest(FIXTURE, idMap, encrypted);

    // SyncRequest has no life_events_create field
    expect(sync).not.toHaveProperty("life_events_create");
  });

  it("remaps person IDs in classifications and patterns", () => {
    uuidCounter = 0;
    const idMap = buildIdMap(FIXTURE);

    const encrypted = new Map<string, string>();
    for (const [key] of idMap) {
      encrypted.set(key, `encrypted-${key}`);
    }

    const sync = buildSyncRequest(FIXTURE, idMap, encrypted);

    expect(sync.classifications_create![0].person_ids).toEqual([idMap.get("demo-p2")]);
    expect(sync.patterns_create![0].person_ids).toEqual([
      idMap.get("demo-p1"),
      idMap.get("demo-p2"),
    ]);
  });
});

describe("createDemoTree", () => {
  let mockCreateTree: ReturnType<typeof vi.fn>;
  let mockSyncTree: ReturnType<typeof vi.fn>;
  let mockCreateLifeEvent: ReturnType<typeof vi.fn>;
  let mockCreateTurningPoint: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    uuidCounter = 0;
    const api = await import("./api");
    mockCreateTree = api.createTree as ReturnType<typeof vi.fn>;
    mockSyncTree = api.syncTree as ReturnType<typeof vi.fn>;
    mockCreateLifeEvent = api.createLifeEvent as ReturnType<typeof vi.fn>;
    mockCreateTurningPoint = api.createTurningPoint as ReturnType<typeof vi.fn>;
    mockCreateTree.mockClear();
    mockSyncTree.mockClear();
    mockCreateLifeEvent.mockClear();
    mockCreateTurningPoint.mockClear();
  });

  it("creates a tree with is_demo flag and encrypts the tree name", async () => {
    const encrypt = vi.fn().mockResolvedValue("encrypted-blob");

    const treeId = await createDemoTree(encrypt, "en");

    expect(treeId).toBe("new-tree-id");
    expect(mockCreateTree).toHaveBeenCalledWith({
      encrypted_data: "encrypted-blob",
      is_demo: true,
    });
  });

  it("calls encrypt for every entity in the fixture", async () => {
    const encrypt = vi.fn().mockResolvedValue("encrypted-blob");

    await createDemoTree(encrypt, "en");

    // 1 tree name + 8 persons + 13 relationships + 7 events + 6 lifeEvents
    // + 4 classifications + 2 patterns = 41 calls from the real en fixture
    expect(encrypt).toHaveBeenCalled();
    // At least: tree name + all entities
    expect(encrypt.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it("calls syncTree with the new tree ID", async () => {
    const encrypt = vi.fn().mockResolvedValue("encrypted-blob");

    await createDemoTree(encrypt, "en");

    expect(mockSyncTree).toHaveBeenCalledTimes(1);
    expect(mockSyncTree.mock.calls[0][0]).toBe("new-tree-id");
  });

  it("creates life events individually via createLifeEvent", async () => {
    const encrypt = vi.fn().mockResolvedValue("encrypted-blob");

    await createDemoTree(encrypt, "en");

    // The en fixture has 6 life events
    expect(mockCreateLifeEvent).toHaveBeenCalled();
    expect(mockCreateLifeEvent.mock.calls.length).toBeGreaterThanOrEqual(1);
    // All calls should use the new tree ID
    for (const call of mockCreateLifeEvent.mock.calls) {
      expect(call[0]).toBe("new-tree-id");
    }
  });

  it("creates turning points individually via createTurningPoint", async () => {
    const encrypt = vi.fn().mockResolvedValue("encrypted-blob");

    await createDemoTree(encrypt, "en");

    // The en fixture has 2 turning points
    expect(mockCreateTurningPoint).toHaveBeenCalled();
    expect(mockCreateTurningPoint.mock.calls.length).toBeGreaterThanOrEqual(1);
    // All calls should use the new tree ID
    for (const call of mockCreateTurningPoint.mock.calls) {
      expect(call[0]).toBe("new-tree-id");
    }
  });

  it("loads Dutch fixture when language starts with nl", async () => {
    const encrypt = vi.fn().mockResolvedValue("encrypted-blob");

    await createDemoTree(encrypt, "nl-NL");

    // Should succeed and use nl fixture (tree name check via encrypt calls)
    expect(mockCreateTree).toHaveBeenCalledTimes(1);
    // First encrypt call is the tree name
    const treeNameArg = encrypt.mock.calls[0][0] as { name: string };
    expect(treeNameArg.name).toContain("Demo");
  });
});
