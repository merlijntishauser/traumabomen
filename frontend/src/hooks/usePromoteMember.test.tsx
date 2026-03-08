import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedSiblingGroup } from "./useTreeData";
import { usePromoteMember } from "./usePromoteMember";

const mockEncrypt = vi.fn().mockResolvedValue("encrypted-blob");

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({ encrypt: mockEncrypt }),
}));

vi.mock("../lib/api");

import * as api from "../lib/api";

const mockedApi = vi.mocked(api);

const TREE_ID = "tree-123";

let queryClient: QueryClient;

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeSyncResponse() {
  return {
    persons_created: ["new-person-id"],
    persons_updated: 0,
    persons_deleted: 0,
    relationships_created: ["rel-1"],
    relationships_updated: 0,
    relationships_deleted: 0,
    events_created: [],
    events_updated: 0,
    events_deleted: 0,
    life_events_created: [],
    life_events_updated: 0,
    life_events_deleted: 0,
    classifications_created: [],
    classifications_updated: 0,
    classifications_deleted: 0,
    turning_points_created: [],
    turning_points_updated: 0,
    turning_points_deleted: 0,
    patterns_created: [],
    patterns_updated: 0,
    patterns_deleted: 0,
    journal_entries_created: [],
    journal_entries_updated: 0,
    journal_entries_deleted: 0,
    sibling_groups_created: [],
    sibling_groups_updated: 1,
    sibling_groups_deleted: 0,
  };
}

function makeGroup(overrides: Partial<DecryptedSiblingGroup> = {}): DecryptedSiblingGroup {
  return {
    id: "sg1",
    person_ids: ["p1", "p2"],
    members: [
      { name: "Alice", birth_year: 1990 },
      { name: "Bob", birth_year: 1992 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEncrypt.mockResolvedValue("encrypted-blob");
});

describe("usePromoteMember", () => {
  it("creates a person, relationships, and updates the sibling group in a single sync call", async () => {
    mockedApi.syncTree.mockResolvedValue(makeSyncResponse());

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePromoteMember(TREE_ID), { wrapper });

    const group = makeGroup();

    await act(async () => {
      await result.current.mutateAsync({ group, memberIndex: 0 });
    });

    expect(mockedApi.syncTree).toHaveBeenCalledTimes(1);
    const syncCall = mockedApi.syncTree.mock.calls[0];
    const syncRequest = syncCall[1];

    // Should create one person
    expect(syncRequest.persons_create).toHaveLength(1);
    expect(syncRequest.persons_create![0].encrypted_data).toBe("encrypted-blob");

    // Should create biological sibling relationships for each existing person_id
    expect(syncRequest.relationships_create).toHaveLength(2);
    for (const rel of syncRequest.relationships_create!) {
      expect(rel.encrypted_data).toBe("encrypted-blob");
    }
    // Source person IDs should be the existing person_ids
    const sourceIds = syncRequest.relationships_create!.map(
      (r: { source_person_id: string }) => r.source_person_id,
    );
    expect(sourceIds).toContain("p1");
    expect(sourceIds).toContain("p2");

    // Should update the sibling group
    expect(syncRequest.sibling_groups_update).toHaveLength(1);
    const groupUpdate = syncRequest.sibling_groups_update![0];
    expect(groupUpdate.id).toBe("sg1");
    // The new person_id should be added to the group
    expect(groupUpdate.person_ids).toHaveLength(3);
    expect(groupUpdate.person_ids).toContain("p1");
    expect(groupUpdate.person_ids).toContain("p2");
  });

  it("encrypts person data, relationship data, and sibling group data", async () => {
    mockedApi.syncTree.mockResolvedValue(makeSyncResponse());

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePromoteMember(TREE_ID), { wrapper });

    const group = makeGroup();

    await act(async () => {
      await result.current.mutateAsync({ group, memberIndex: 0 });
    });

    // encrypt called for: 1 person + 2 relationships + 1 sibling group update = 4 calls
    expect(mockEncrypt).toHaveBeenCalledTimes(4);

    // First call should be the person data
    expect(mockEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Alice",
        birth_year: 1990,
        gender: "other",
      }),
      TREE_ID,
    );

    // Should encrypt relationship data (biological sibling)
    expect(mockEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "biological_sibling",
        periods: [],
        active_period: null,
      }),
      TREE_ID,
    );

    // Should encrypt updated sibling group data (with Alice removed from members)
    expect(mockEncrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        members: [{ name: "Bob", birth_year: 1992 }],
      }),
      TREE_ID,
    );
  });

  it("removes the promoted member from the group's members array", async () => {
    mockedApi.syncTree.mockResolvedValue(makeSyncResponse());

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePromoteMember(TREE_ID), { wrapper });

    const group = makeGroup();

    await act(async () => {
      await result.current.mutateAsync({ group, memberIndex: 1 });
    });

    // Bob (index 1) is promoted; only Alice remains
    const groupUpdateCall = mockEncrypt.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "object" && call[0] !== null && "members" in (call[0] as object),
    );
    expect(groupUpdateCall).toBeDefined();
    expect((groupUpdateCall![0] as { members: unknown[] }).members).toEqual([
      { name: "Alice", birth_year: 1990 },
    ]);
  });

  it("invalidates persons, relationships, and siblingGroups queries on success", async () => {
    mockedApi.syncTree.mockResolvedValue(makeSyncResponse());

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePromoteMember(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ group: makeGroup(), memberIndex: 0 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "persons"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "relationships"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "siblingGroups"],
    });
  });

  it("throws for invalid member index", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePromoteMember(TREE_ID), { wrapper });

    const group = makeGroup();

    await expect(
      act(async () => {
        await result.current.mutateAsync({ group, memberIndex: 99 });
      }),
    ).rejects.toThrow("Invalid member index");
  });

  it("handles group with no existing person_ids (no relationships created)", async () => {
    mockedApi.syncTree.mockResolvedValue(makeSyncResponse());

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePromoteMember(TREE_ID), { wrapper });

    const group = makeGroup({ person_ids: [] });

    await act(async () => {
      await result.current.mutateAsync({ group, memberIndex: 0 });
    });

    const syncRequest = mockedApi.syncTree.mock.calls[0][1];

    // No relationships to create since there are no existing person_ids
    expect(syncRequest.relationships_create).toHaveLength(0);

    // Should still create the person
    expect(syncRequest.persons_create).toHaveLength(1);

    // Group update should contain the new person_id
    expect(syncRequest.sibling_groups_update![0].person_ids).toHaveLength(1);
  });
});
