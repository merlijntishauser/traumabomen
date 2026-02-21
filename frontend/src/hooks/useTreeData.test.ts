import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { treeQueryKeys, useTreeData } from "./useTreeData";

vi.mock("../contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    decrypt: async (blob: string) => JSON.parse(blob),
  }),
}));

vi.mock("../lib/api", () => ({
  getTree: vi.fn().mockResolvedValue({
    id: "tree1",
    encrypted_data: JSON.stringify({ name: "Test Tree" }),
  }),
  getPersons: vi.fn().mockResolvedValue([
    {
      id: "p1",
      encrypted_data: JSON.stringify({
        name: "Alice",
        birth_year: 1980,
        death_year: null,
        gender: "female",
        is_adopted: false,
        notes: null,
      }),
    },
  ]),
  getRelationships: vi.fn().mockResolvedValue([
    {
      id: "r1",
      source_person_id: "p1",
      target_person_id: "p2",
      encrypted_data: JSON.stringify({ type: "partner", periods: [] }),
    },
  ]),
  getEvents: vi.fn().mockResolvedValue([
    {
      id: "e1",
      person_ids: ["p1"],
      encrypted_data: JSON.stringify({
        title: "Event",
        description: "",
        category: "loss",
        approximate_date: "1990",
        severity: 3,
        tags: [],
      }),
    },
  ]),
  getLifeEvents: vi.fn().mockResolvedValue([
    {
      id: "le1",
      person_ids: ["p1"],
      encrypted_data: JSON.stringify({
        title: "Graduated",
        description: "Finished university",
        category: "education",
        approximate_date: "2002",
        impact: 2,
        tags: [],
      }),
    },
  ]),
  getClassifications: vi.fn().mockResolvedValue([
    {
      id: "cls1",
      person_ids: ["p1"],
      encrypted_data: JSON.stringify({
        dsm_category: "depressive",
        dsm_subcategory: null,
        status: "diagnosed",
        diagnosis_year: 1995,
        periods: [{ start_year: 1995, end_year: null }],
        notes: null,
      }),
    },
  ]),
  getTurningPoints: vi.fn().mockResolvedValue([
    {
      id: "tp1",
      person_ids: ["p1"],
      encrypted_data: JSON.stringify({
        title: "Broke the cycle",
        description: "Sought therapy",
        category: "cycle_breaking",
        approximate_date: "2010",
        significance: 4,
        tags: [],
      }),
    },
  ]),
  getPatterns: vi.fn().mockResolvedValue([
    {
      id: "pat1",
      person_ids: ["p1"],
      encrypted_data: JSON.stringify({
        name: "Test Pattern",
        description: "",
        color: "#818cf8",
        linked_entities: [],
      }),
    },
  ]),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    QueryClientProvider({ client: queryClient, children });
}

describe("useTreeData", () => {
  it("returns empty maps while loading", () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.persons.size).toBe(0);
    expect(result.current.relationships.size).toBe(0);
    expect(result.current.events.size).toBe(0);
    expect(result.current.lifeEvents.size).toBe(0);
    expect(result.current.turningPoints.size).toBe(0);
    expect(result.current.classifications.size).toBe(0);
    expect(result.current.patterns.size).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  it("decrypts and returns persons after loading", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.persons.size).toBe(1);
    expect(result.current.persons.get("p1")?.name).toBe("Alice");
  });

  it("decrypts and returns tree name", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.treeName).toBe("Test Tree"));
  });

  it("decrypts and returns relationships", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.relationships.size).toBe(1);
    const rel = result.current.relationships.get("r1");
    expect(rel?.source_person_id).toBe("p1");
    expect(rel?.target_person_id).toBe("p2");
  });

  it("decrypts and returns events", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events.size).toBe(1);
    expect(result.current.events.get("e1")?.title).toBe("Event");
  });

  it("decrypts and returns life events after loading", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.lifeEvents.size).toBe(1);
    const le = result.current.lifeEvents.get("le1");
    expect(le?.title).toBe("Graduated");
    expect(le?.person_ids).toEqual(["p1"]);
  });

  it("decrypts and returns turning points after loading", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.turningPoints.size).toBe(1);
    const tp = result.current.turningPoints.get("tp1");
    expect(tp?.title).toBe("Broke the cycle");
    expect(tp?.person_ids).toEqual(["p1"]);
  });

  it("decrypts and returns classifications after loading", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.classifications.size).toBe(1);
    const cls = result.current.classifications.get("cls1");
    expect(cls?.dsm_category).toBe("depressive");
    expect(cls?.person_ids).toEqual(["p1"]);
  });

  it("decrypts and returns patterns after loading", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.patterns.size).toBe(1);
    expect(result.current.patterns.get("pat1")?.name).toBe("Test Pattern");
  });

  it("returns no error on success", async () => {
    const { result } = renderHook(() => useTreeData("tree1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});

describe("treeQueryKeys", () => {
  it("generates correct query keys", () => {
    expect(treeQueryKeys.tree("abc")).toEqual(["trees", "abc"]);
    expect(treeQueryKeys.persons("abc")).toEqual(["trees", "abc", "persons"]);
    expect(treeQueryKeys.relationships("abc")).toEqual(["trees", "abc", "relationships"]);
    expect(treeQueryKeys.events("abc")).toEqual(["trees", "abc", "events"]);
    expect(treeQueryKeys.lifeEvents("abc")).toEqual(["trees", "abc", "lifeEvents"]);
    expect(treeQueryKeys.turningPoints("abc")).toEqual(["trees", "abc", "turningPoints"]);
    expect(treeQueryKeys.classifications("abc")).toEqual(["trees", "abc", "classifications"]);
    expect(treeQueryKeys.patterns("abc")).toEqual(["trees", "abc", "patterns"]);
  });
});
