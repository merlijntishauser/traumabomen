import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTreeMutations } from "./useTreeMutations";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockEncrypt.mockResolvedValue("encrypted-blob");
});

// ---------------------------------------------------------------------------
// Linked entity test factory
// ---------------------------------------------------------------------------

interface LinkedEntityTestConfig {
  name: string;
  idPrefix: string;
  hookAccessor: (r: ReturnType<typeof useTreeMutations>) => {
    // biome-ignore lint/suspicious/noExplicitAny: test factory uses dynamic mutation types
    create: { mutateAsync: (args: any) => Promise<any> };
    // biome-ignore lint/suspicious/noExplicitAny: test factory uses dynamic mutation types
    update: { mutateAsync: (args: any) => Promise<any>; mutate: (args: any) => void };
    // biome-ignore lint/suspicious/noExplicitAny: test factory uses dynamic mutation types
    delete: { mutateAsync: (id: any) => Promise<any> };
  };
  queryKeySegment: string;
  // biome-ignore lint/suspicious/noExplicitAny: test mock type
  apiCreate: any;
  // biome-ignore lint/suspicious/noExplicitAny: test mock type
  apiUpdate: any;
  // biome-ignore lint/suspicious/noExplicitAny: test mock type
  apiDelete: any;
  testData: Record<string, unknown>;
  existingEntry: Record<string, unknown>;
  optimisticChecks: (entry: Record<string, unknown>) => void;
  rollbackChecks: (entry: Record<string, unknown>) => void;
}

function describeLinkedEntityMutations(config: LinkedEntityTestConfig) {
  const entityId = `${config.idPrefix}-1`;
  const otherId = `${config.idPrefix}-other`;
  const nonexistentId = `${config.idPrefix}-nonexistent`;
  const queryKey = ["trees", TREE_ID, config.queryKeySegment];

  const apiResponse = () => ({
    id: entityId,
    tree_id: TREE_ID,
    person_ids: ["p-1"],
    encrypted_data: "encrypted-blob",
  });

  const fullEntry = (overrides: Record<string, unknown>, id = entityId) => ({
    id,
    person_ids: ["p-1"],
    ...overrides,
  });

  describe(`${config.name} mutations`, () => {
    it("create encrypts data then calls API", async () => {
      config.apiCreate.mockResolvedValue(apiResponse());

      const { result } = renderHook(() => useTreeMutations(TREE_ID), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await config.hookAccessor(result.current).create.mutateAsync({
          personIds: ["p-1"],
          data: config.testData,
        });
      });

      expect(mockEncrypt).toHaveBeenCalledWith(config.testData, TREE_ID);
      expect(config.apiCreate).toHaveBeenCalledWith(TREE_ID, {
        person_ids: ["p-1"],
        encrypted_data: "encrypted-blob",
      });
    });

    it("create invalidates query key on success", async () => {
      config.apiCreate.mockResolvedValue(apiResponse());

      const wrapper = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      await act(async () => {
        await config.hookAccessor(result.current).create.mutateAsync({
          personIds: ["p-1"],
          data: config.testData,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    });

    it("update encrypts data then calls API", async () => {
      config.apiUpdate.mockResolvedValue(apiResponse());

      const { result } = renderHook(() => useTreeMutations(TREE_ID), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await config.hookAccessor(result.current).update.mutateAsync({
          entityId,
          personIds: ["p-1"],
          data: config.testData,
        });
      });

      expect(mockEncrypt).toHaveBeenCalledWith(config.testData, TREE_ID);
      expect(config.apiUpdate).toHaveBeenCalledWith(TREE_ID, entityId, {
        person_ids: ["p-1"],
        encrypted_data: "encrypted-blob",
      });
    });

    it("update performs optimistic update via onMutate", async () => {
      const existing = new Map([[entityId, fullEntry(config.existingEntry)]]);

      config.apiUpdate.mockReturnValue(new Promise(() => {}));

      const wrapper = createWrapper();
      queryClient.setQueryData(queryKey, existing);

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      act(() => {
        config.hookAccessor(result.current).update.mutate({
          entityId,
          personIds: ["p-1", "p-2"],
          data: config.testData,
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<Map<string, unknown>>(queryKey);
        const entry = cached?.get(entityId) as Record<string, unknown> | undefined;
        config.optimisticChecks(entry!);
        expect(entry?.person_ids).toEqual(["p-1", "p-2"]);
      });
    });

    it("update onMutate handles empty cache gracefully", async () => {
      config.apiUpdate.mockReturnValue(new Promise(() => {}));

      const wrapper = createWrapper();

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      act(() => {
        config.hookAccessor(result.current).update.mutate({
          entityId,
          personIds: ["p-1"],
          data: config.testData,
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData(queryKey);
        expect(cached).toBeUndefined();
      });
    });

    it("update onMutate skips unknown entity ID", async () => {
      const existing = new Map([[otherId, fullEntry(config.existingEntry, otherId)]]);

      config.apiUpdate.mockReturnValue(new Promise(() => {}));

      const wrapper = createWrapper();
      queryClient.setQueryData(queryKey, existing);

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      act(() => {
        config.hookAccessor(result.current).update.mutate({
          entityId: nonexistentId,
          personIds: ["p-1"],
          data: config.testData,
        });
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<Map<string, unknown>>(queryKey);
        expect(cached?.size).toBe(1);
        expect(cached?.has(otherId)).toBe(true);
        expect(cached?.has(nonexistentId)).toBe(false);
      });
    });

    it("update rolls back on error via onError", async () => {
      const existing = new Map([[entityId, fullEntry(config.existingEntry)]]);

      config.apiUpdate.mockRejectedValue(new Error("network error"));

      const wrapper = createWrapper();
      queryClient.setQueryData(queryKey, existing);

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      await act(async () => {
        try {
          await config.hookAccessor(result.current).update.mutateAsync({
            entityId,
            personIds: ["p-1"],
            data: config.testData,
          });
        } catch {
          // expected
        }
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData<Map<string, unknown>>(queryKey);
        const entry = cached?.get(entityId) as Record<string, unknown> | undefined;
        expect(entry).toBeDefined();
        config.rollbackChecks(entry!);
      });
    });

    it("update onError without previous context is a no-op", async () => {
      config.apiUpdate.mockRejectedValue(new Error("fail"));

      const wrapper = createWrapper();

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      await act(async () => {
        try {
          await config.hookAccessor(result.current).update.mutateAsync({
            entityId,
            personIds: ["p-1"],
            data: config.testData,
          });
        } catch {
          // expected
        }
      });

      const cached = queryClient.getQueryData(queryKey);
      expect(cached).toBeUndefined();
    });

    it("update invalidates query on settled", async () => {
      config.apiUpdate.mockResolvedValue(apiResponse());

      const wrapper = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      await act(async () => {
        await config.hookAccessor(result.current).update.mutateAsync({
          entityId,
          personIds: ["p-1"],
          data: config.testData,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    });

    it("delete calls API without encryption", async () => {
      config.apiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTreeMutations(TREE_ID), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await config.hookAccessor(result.current).delete.mutateAsync(entityId);
      });

      expect(mockEncrypt).not.toHaveBeenCalled();
      expect(config.apiDelete).toHaveBeenCalledWith(TREE_ID, entityId);
    });

    it("delete invalidates query key on success", async () => {
      config.apiDelete.mockResolvedValue(undefined);

      const wrapper = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

      await act(async () => {
        await config.hookAccessor(result.current).delete.mutateAsync(entityId);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    });
  });
}

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------
describe("person mutations", () => {
  it("createPerson encrypts data then calls api.createPerson", async () => {
    const personData = {
      name: "Alice",
      birth_year: 1990,
      birth_month: null,
      birth_day: null,
      death_year: null,
      death_month: null,
      death_day: null,
      cause_of_death: null,
      gender: "female",
      is_adopted: false,
      notes: null,
    };
    mockedApi.createPerson.mockResolvedValue({
      id: "p-1",
      tree_id: TREE_ID,
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createPerson.mutateAsync(personData);
    });

    expect(mockEncrypt).toHaveBeenCalledWith(personData, TREE_ID);
    expect(mockedApi.createPerson).toHaveBeenCalledWith(TREE_ID, {
      encrypted_data: "encrypted-blob",
    });
  });

  it("createPerson invalidates persons query key on success", async () => {
    mockedApi.createPerson.mockResolvedValue({
      id: "p-1",
      tree_id: TREE_ID,
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createPerson.mutateAsync({
        name: "Bob",
        birth_year: 1980,
        birth_month: null,
        birth_day: null,
        death_year: null,
        death_month: null,
        death_day: null,
        cause_of_death: null,
        gender: "male",
        is_adopted: false,
        notes: null,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "persons"],
    });
  });

  it("updatePerson encrypts data then calls api.updatePerson", async () => {
    const personData = {
      name: "Alice Updated",
      birth_year: 1990,
      birth_month: null,
      birth_day: null,
      death_year: null,
      death_month: null,
      death_day: null,
      cause_of_death: null,
      gender: "female",
      is_adopted: false,
      notes: "updated",
    };
    mockedApi.updatePerson.mockResolvedValue({
      id: "p-1",
      tree_id: TREE_ID,
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updatePerson.mutateAsync({
        personId: "p-1",
        data: personData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(personData, TREE_ID);
    expect(mockedApi.updatePerson).toHaveBeenCalledWith(TREE_ID, "p-1", {
      encrypted_data: "encrypted-blob",
    });
  });

  it("updatePerson invalidates persons query key on success", async () => {
    mockedApi.updatePerson.mockResolvedValue({
      id: "p-1",
      tree_id: TREE_ID,
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updatePerson.mutateAsync({
        personId: "p-1",
        data: {
          name: "X",
          birth_year: null,
          birth_month: null,
          birth_day: null,
          death_year: null,
          death_month: null,
          death_day: null,
          cause_of_death: null,
          gender: "other",
          is_adopted: false,
          notes: null,
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "persons"],
    });
  });

  it("deletePerson calls api.deletePerson without encryption", async () => {
    mockedApi.deletePerson.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deletePerson.mutateAsync("p-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deletePerson).toHaveBeenCalledWith(TREE_ID, "p-1");
  });

  it("deletePerson invalidates 8 query keys on success", async () => {
    mockedApi.deletePerson.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deletePerson.mutateAsync("p-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "persons"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "relationships"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "events"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "lifeEvents"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "turningPoints"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "classifications"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "patterns"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "siblingGroups"],
    });
    // Exactly 8 invalidation calls
    expect(invalidateSpy).toHaveBeenCalledTimes(8);
  });
});

// ---------------------------------------------------------------------------
// Batch person updates
// ---------------------------------------------------------------------------
describe("batchUpdatePersons", () => {
  it("calls syncTree with persons_update and invalidates persons query", async () => {
    mockedApi.syncTree.mockResolvedValue({
      persons_created: [],
      persons_updated: 2,
      persons_deleted: 0,
      relationships_created: [],
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
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    const entries = [
      {
        personId: "p-1",
        data: {
          name: "Alice",
          birth_year: 1990,
          birth_month: null,
          birth_day: null,
          death_year: null,
          death_month: null,
          death_day: null,
          cause_of_death: null,
          gender: "female" as const,
          is_adopted: false,
          notes: null,
        },
      },
      {
        personId: "p-2",
        data: {
          name: "Bob",
          birth_year: 1985,
          birth_month: null,
          birth_day: null,
          death_year: null,
          death_month: null,
          death_day: null,
          cause_of_death: null,
          gender: "male" as const,
          is_adopted: false,
          notes: null,
        },
      },
    ];

    await act(async () => {
      await result.current.batchUpdatePersons.mutateAsync(entries);
    });

    expect(mockEncrypt).toHaveBeenCalledTimes(2);
    expect(mockedApi.syncTree).toHaveBeenCalledWith(TREE_ID, {
      persons_update: [
        { id: "p-1", encrypted_data: "encrypted-blob" },
        { id: "p-2", encrypted_data: "encrypted-blob" },
      ],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "persons"],
    });
  });
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------
describe("relationship mutations", () => {
  const relationshipData = {
    type: "biological_parent" as const,
    periods: [],
    active_period: null,
  };

  it("createRelationship encrypts data then calls api.createRelationship", async () => {
    mockedApi.createRelationship.mockResolvedValue({
      id: "r-1",
      tree_id: TREE_ID,
      source_person_id: "p-1",
      target_person_id: "p-2",
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createRelationship.mutateAsync({
        sourcePersonId: "p-1",
        targetPersonId: "p-2",
        data: relationshipData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(relationshipData, TREE_ID);
    expect(mockedApi.createRelationship).toHaveBeenCalledWith(TREE_ID, {
      source_person_id: "p-1",
      target_person_id: "p-2",
      encrypted_data: "encrypted-blob",
    });
  });

  it("createRelationship invalidates relationships query key on success", async () => {
    mockedApi.createRelationship.mockResolvedValue({
      id: "r-1",
      tree_id: TREE_ID,
      source_person_id: "p-1",
      target_person_id: "p-2",
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createRelationship.mutateAsync({
        sourcePersonId: "p-1",
        targetPersonId: "p-2",
        data: relationshipData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "relationships"],
    });
  });

  it("updateRelationship encrypts data then calls api.updateRelationship", async () => {
    mockedApi.updateRelationship.mockResolvedValue({
      id: "r-1",
      tree_id: TREE_ID,
      source_person_id: "p-1",
      target_person_id: "p-2",
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateRelationship.mutateAsync({
        relationshipId: "r-1",
        data: relationshipData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(relationshipData, TREE_ID);
    expect(mockedApi.updateRelationship).toHaveBeenCalledWith(TREE_ID, "r-1", {
      encrypted_data: "encrypted-blob",
    });
  });

  it("updateRelationship invalidates relationships query key on success", async () => {
    mockedApi.updateRelationship.mockResolvedValue({
      id: "r-1",
      tree_id: TREE_ID,
      source_person_id: "p-1",
      target_person_id: "p-2",
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updateRelationship.mutateAsync({
        relationshipId: "r-1",
        data: relationshipData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "relationships"],
    });
  });

  it("deleteRelationship calls api.deleteRelationship without encryption", async () => {
    mockedApi.deleteRelationship.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteRelationship.mutateAsync("r-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deleteRelationship).toHaveBeenCalledWith(TREE_ID, "r-1");
  });

  it("deleteRelationship invalidates relationships query key on success", async () => {
    mockedApi.deleteRelationship.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deleteRelationship.mutateAsync("r-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "relationships"],
    });
  });
});

// ---------------------------------------------------------------------------
// Linked entities (parameterized via factory)
// ---------------------------------------------------------------------------

describeLinkedEntityMutations({
  name: "event",
  idPrefix: "e",
  hookAccessor: (r) => r.events,
  queryKeySegment: "events",
  apiCreate: mockedApi.createEvent,
  apiUpdate: mockedApi.updateEvent,
  apiDelete: mockedApi.deleteEvent,
  testData: {
    title: "Test Event",
    description: "desc",
    category: "loss",
    approximate_date: "1990",
    severity: 5,
    tags: ["tag1"],
  },
  existingEntry: {
    title: "Old Title",
    description: "old",
    category: "loss",
    approximate_date: "1985",
    severity: 3,
    tags: [],
  },
  optimisticChecks: (entry) => {
    expect(entry?.title).toBe("Test Event");
  },
  rollbackChecks: (entry) => {
    expect(entry?.title).toBe("Old Title");
  },
});

describeLinkedEntityMutations({
  name: "life event",
  idPrefix: "le",
  hookAccessor: (r) => r.lifeEvents,
  queryKeySegment: "lifeEvents",
  apiCreate: mockedApi.createLifeEvent,
  apiUpdate: mockedApi.updateLifeEvent,
  apiDelete: mockedApi.deleteLifeEvent,
  testData: {
    title: "Graduated",
    description: "University",
    category: "education",
    approximate_date: "2012",
    impact: 7,
    tags: [],
  },
  existingEntry: {
    title: "Old Title",
    description: "old",
    category: "career",
    approximate_date: "2000",
    impact: 3,
    tags: [],
  },
  optimisticChecks: (entry) => {
    expect(entry?.title).toBe("Graduated");
  },
  rollbackChecks: (entry) => {
    expect(entry?.title).toBe("Old Title");
  },
});

describeLinkedEntityMutations({
  name: "turning point",
  idPrefix: "tp",
  hookAccessor: (r) => r.turningPoints,
  queryKeySegment: "turningPoints",
  apiCreate: mockedApi.createTurningPoint,
  apiUpdate: mockedApi.updateTurningPoint,
  apiDelete: mockedApi.deleteTurningPoint,
  testData: {
    title: "Broke the cycle",
    description: "Sought therapy",
    category: "cycle_breaking",
    approximate_date: "2010",
    significance: 4,
    tags: [],
  },
  existingEntry: {
    title: "Old Title",
    description: "old",
    category: "recovery",
    approximate_date: "2005",
    significance: 2,
    tags: [],
  },
  optimisticChecks: (entry) => {
    expect(entry?.title).toBe("Broke the cycle");
  },
  rollbackChecks: (entry) => {
    expect(entry?.title).toBe("Old Title");
  },
});

describeLinkedEntityMutations({
  name: "classification",
  idPrefix: "c",
  hookAccessor: (r) => r.classifications,
  queryKeySegment: "classifications",
  apiCreate: mockedApi.createClassification,
  apiUpdate: mockedApi.updateClassification,
  apiDelete: mockedApi.deleteClassification,
  testData: {
    dsm_category: "neurodevelopmental",
    dsm_subcategory: "ADHD",
    status: "diagnosed",
    diagnosis_year: 2020,
    periods: [{ start_year: 2020, end_year: null }],
    notes: null,
  },
  existingEntry: {
    dsm_category: "anxiety",
    dsm_subcategory: null,
    status: "suspected",
    diagnosis_year: null,
    periods: [],
    notes: null,
  },
  optimisticChecks: (entry) => {
    expect(entry?.dsm_category).toBe("neurodevelopmental");
    expect(entry?.dsm_subcategory).toBe("ADHD");
    expect(entry?.status).toBe("diagnosed");
  },
  rollbackChecks: (entry) => {
    expect(entry?.dsm_category).toBe("anxiety");
  },
});

describeLinkedEntityMutations({
  name: "pattern",
  idPrefix: "pat",
  hookAccessor: (r) => r.patterns,
  queryKeySegment: "patterns",
  apiCreate: mockedApi.createPattern,
  apiUpdate: mockedApi.updatePattern,
  apiDelete: mockedApi.deletePattern,
  testData: {
    name: "Test Pattern",
    description: "desc",
    color: "#818cf8",
    linked_entities: [{ entity_type: "trauma_event", entity_id: "e-1" }],
  },
  existingEntry: {
    name: "Old Pattern",
    description: "old",
    color: "#000000",
    linked_entities: [],
  },
  optimisticChecks: (entry) => {
    expect(entry?.name).toBe("Test Pattern");
  },
  rollbackChecks: (entry) => {
    expect(entry?.name).toBe("Old Pattern");
  },
});

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------
describe("journal entry mutations", () => {
  const journalData = {
    text: "My reflection",
    linked_entities: [{ entity_type: "person" as const, entity_id: "p-1" }],
  };

  it("createJournalEntry encrypts data then calls api.createJournalEntry", async () => {
    mockedApi.createJournalEntry.mockResolvedValue({
      id: "j-1",
      encrypted_data: "encrypted-blob",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createJournalEntry.mutateAsync(journalData);
    });

    expect(mockEncrypt).toHaveBeenCalledWith(journalData, TREE_ID);
    expect(mockedApi.createJournalEntry).toHaveBeenCalledWith(TREE_ID, {
      encrypted_data: "encrypted-blob",
    });
  });

  it("createJournalEntry invalidates journalEntries query key on success", async () => {
    mockedApi.createJournalEntry.mockResolvedValue({
      id: "j-1",
      encrypted_data: "encrypted-blob",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createJournalEntry.mutateAsync(journalData);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "journalEntries"],
    });
  });

  it("updateJournalEntry encrypts data then calls api.updateJournalEntry", async () => {
    mockedApi.updateJournalEntry.mockResolvedValue({
      id: "j-1",
      encrypted_data: "encrypted-blob",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateJournalEntry.mutateAsync({
        entryId: "j-1",
        data: journalData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(journalData, TREE_ID);
    expect(mockedApi.updateJournalEntry).toHaveBeenCalledWith(TREE_ID, "j-1", {
      encrypted_data: "encrypted-blob",
    });
  });

  it("updateJournalEntry invalidates journalEntries query key on success", async () => {
    mockedApi.updateJournalEntry.mockResolvedValue({
      id: "j-1",
      encrypted_data: "encrypted-blob",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updateJournalEntry.mutateAsync({
        entryId: "j-1",
        data: journalData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "journalEntries"],
    });
  });

  it("deleteJournalEntry calls api.deleteJournalEntry without encryption", async () => {
    mockedApi.deleteJournalEntry.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteJournalEntry.mutateAsync("j-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deleteJournalEntry).toHaveBeenCalledWith(TREE_ID, "j-1");
  });

  it("deleteJournalEntry invalidates journalEntries query key on success", async () => {
    mockedApi.deleteJournalEntry.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deleteJournalEntry.mutateAsync("j-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "journalEntries"],
    });
  });
});
