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
  getLifeEvents: vi.fn().mockResolvedValue([]),
  getClassifications: vi.fn().mockResolvedValue([]),
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
    expect(result.current.classifications.size).toBe(0);
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
    expect(treeQueryKeys.classifications("abc")).toEqual(["trees", "abc", "classifications"]);
  });
});
