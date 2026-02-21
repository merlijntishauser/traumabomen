import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTreeMutations } from "./useTreeMutations";

const mockEncrypt = vi.fn().mockResolvedValue("encrypted-blob");

vi.mock("../contexts/EncryptionContext", () => ({
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

    expect(mockEncrypt).toHaveBeenCalledWith(personData);
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

    expect(mockEncrypt).toHaveBeenCalledWith(personData);
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

  it("deletePerson invalidates 6 query keys on success", async () => {
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
      queryKey: ["trees", TREE_ID, "classifications"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "patterns"],
    });
    // Exactly 6 invalidation calls
    expect(invalidateSpy).toHaveBeenCalledTimes(6);
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

    expect(mockEncrypt).toHaveBeenCalledWith(relationshipData);
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

    expect(mockEncrypt).toHaveBeenCalledWith(relationshipData);
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
// Events (trauma events)
// ---------------------------------------------------------------------------
describe("event mutations", () => {
  const eventData = {
    title: "Test Event",
    description: "desc",
    category: "loss" as const,
    approximate_date: "1990",
    severity: 5,
    tags: ["tag1"],
  };

  it("createEvent encrypts data then calls api.createEvent", async () => {
    mockedApi.createEvent.mockResolvedValue({
      id: "e-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createEvent.mutateAsync({
        personIds: ["p-1"],
        data: eventData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(eventData);
    expect(mockedApi.createEvent).toHaveBeenCalledWith(TREE_ID, {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("createEvent invalidates events query key on success", async () => {
    mockedApi.createEvent.mockResolvedValue({
      id: "e-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createEvent.mutateAsync({
        personIds: ["p-1"],
        data: eventData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "events"],
    });
  });

  it("updateEvent encrypts data then calls api.updateEvent", async () => {
    mockedApi.updateEvent.mockResolvedValue({
      id: "e-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateEvent.mutateAsync({
        eventId: "e-1",
        personIds: ["p-1"],
        data: eventData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(eventData);
    expect(mockedApi.updateEvent).toHaveBeenCalledWith(TREE_ID, "e-1", {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("updateEvent performs optimistic update via onMutate", async () => {
    // Set up existing data in the query cache
    const existingEvents = new Map([
      [
        "e-1",
        {
          id: "e-1",
          person_ids: ["p-1"],
          title: "Old Title",
          description: "old desc",
          category: "loss" as const,
          approximate_date: "1985",
          severity: 3,
          tags: [],
        },
      ],
    ]);

    // Never resolves so we can inspect the optimistic state
    mockedApi.updateEvent.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "events"], existingEvents);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateEvent.mutate({
        eventId: "e-1",
        personIds: ["p-1", "p-2"],
        data: eventData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>(["trees", TREE_ID, "events"]);
      const entry = cached?.get("e-1") as Record<string, unknown> | undefined;
      expect(entry?.title).toBe("Test Event");
      expect(entry?.person_ids).toEqual(["p-1", "p-2"]);
    });
  });

  it("updateEvent onMutate handles empty cache gracefully", async () => {
    // No prior cache data set — the `if (previous)` branch should be false
    mockedApi.updateEvent.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    // Intentionally do NOT set query data

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateEvent.mutate({
        eventId: "e-1",
        personIds: ["p-1"],
        data: eventData,
      });
    });

    await waitFor(() => {
      // Cache should remain undefined
      const cached = queryClient.getQueryData(["trees", TREE_ID, "events"]);
      expect(cached).toBeUndefined();
    });
  });

  it("updateEvent onMutate skips unknown entity ID", async () => {
    // Cache exists but the specific eventId is not in it
    const existingEvents = new Map([
      [
        "e-other",
        {
          id: "e-other",
          person_ids: ["p-1"],
          title: "Other Event",
          description: "other",
          category: "loss" as const,
          approximate_date: "1985",
          severity: 3,
          tags: [],
        },
      ],
    ]);

    mockedApi.updateEvent.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "events"], existingEvents);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateEvent.mutate({
        eventId: "e-nonexistent",
        personIds: ["p-1"],
        data: eventData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>(["trees", TREE_ID, "events"]);
      // The "e-other" entry should remain untouched and "e-nonexistent" should not be added
      expect(cached?.size).toBe(1);
      expect(cached?.has("e-other")).toBe(true);
      expect(cached?.has("e-nonexistent")).toBe(false);
    });
  });

  it("updateEvent rolls back on error via onError", async () => {
    const existingEvents = new Map([
      [
        "e-1",
        {
          id: "e-1",
          person_ids: ["p-1"],
          title: "Original",
          description: "orig",
          category: "loss" as const,
          approximate_date: "1985",
          severity: 3,
          tags: [],
        },
      ],
    ]);

    mockedApi.updateEvent.mockRejectedValue(new Error("network error"));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "events"], existingEvents);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updateEvent.mutateAsync({
          eventId: "e-1",
          personIds: ["p-1"],
          data: eventData,
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>(["trees", TREE_ID, "events"]);
      const entry = cached?.get("e-1") as Record<string, unknown> | undefined;
      expect(entry?.title).toBe("Original");
    });
  });

  it("updateEvent onError without previous context is a no-op", async () => {
    mockedApi.updateEvent.mockRejectedValue(new Error("fail"));

    const wrapper = createWrapper();
    // No cache set, so onMutate returns { previous: undefined }
    // onError should handle context?.previous being falsy

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updateEvent.mutateAsync({
          eventId: "e-1",
          personIds: ["p-1"],
          data: eventData,
        });
      } catch {
        // expected
      }
    });

    // No crash; cache remains undefined
    const cached = queryClient.getQueryData(["trees", TREE_ID, "events"]);
    expect(cached).toBeUndefined();
  });

  it("updateEvent invalidates events query on settled", async () => {
    mockedApi.updateEvent.mockResolvedValue({
      id: "e-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updateEvent.mutateAsync({
        eventId: "e-1",
        personIds: ["p-1"],
        data: eventData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "events"],
    });
  });

  it("deleteEvent calls api.deleteEvent without encryption", async () => {
    mockedApi.deleteEvent.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteEvent.mutateAsync("e-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deleteEvent).toHaveBeenCalledWith(TREE_ID, "e-1");
  });

  it("deleteEvent invalidates events query key on success", async () => {
    mockedApi.deleteEvent.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deleteEvent.mutateAsync("e-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "events"],
    });
  });
});

// ---------------------------------------------------------------------------
// Life Events
// ---------------------------------------------------------------------------
describe("life event mutations", () => {
  const lifeEventData = {
    title: "Graduated",
    description: "University",
    category: "education" as const,
    approximate_date: "2012",
    impact: 7,
    tags: [],
  };

  it("createLifeEvent encrypts data then calls api.createLifeEvent", async () => {
    mockedApi.createLifeEvent.mockResolvedValue({
      id: "le-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createLifeEvent.mutateAsync({
        personIds: ["p-1"],
        data: lifeEventData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(lifeEventData);
    expect(mockedApi.createLifeEvent).toHaveBeenCalledWith(TREE_ID, {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("createLifeEvent invalidates lifeEvents query key on success", async () => {
    mockedApi.createLifeEvent.mockResolvedValue({
      id: "le-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createLifeEvent.mutateAsync({
        personIds: ["p-1"],
        data: lifeEventData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "lifeEvents"],
    });
  });

  it("updateLifeEvent encrypts data then calls api.updateLifeEvent", async () => {
    mockedApi.updateLifeEvent.mockResolvedValue({
      id: "le-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateLifeEvent.mutateAsync({
        lifeEventId: "le-1",
        personIds: ["p-1"],
        data: lifeEventData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(lifeEventData);
    expect(mockedApi.updateLifeEvent).toHaveBeenCalledWith(TREE_ID, "le-1", {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("updateLifeEvent performs optimistic update via onMutate", async () => {
    const existingLifeEvents = new Map([
      [
        "le-1",
        {
          id: "le-1",
          person_ids: ["p-1"],
          title: "Old Title",
          description: "old",
          category: "career" as const,
          approximate_date: "2000",
          impact: 3,
          tags: [],
        },
      ],
    ]);

    mockedApi.updateLifeEvent.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "lifeEvents"], existingLifeEvents);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateLifeEvent.mutate({
        lifeEventId: "le-1",
        personIds: ["p-1", "p-3"],
        data: lifeEventData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>([
        "trees",
        TREE_ID,
        "lifeEvents",
      ]);
      const entry = cached?.get("le-1") as Record<string, unknown> | undefined;
      expect(entry?.title).toBe("Graduated");
      expect(entry?.person_ids).toEqual(["p-1", "p-3"]);
    });
  });

  it("updateLifeEvent onMutate handles empty cache gracefully", async () => {
    mockedApi.updateLifeEvent.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateLifeEvent.mutate({
        lifeEventId: "le-1",
        personIds: ["p-1"],
        data: lifeEventData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(["trees", TREE_ID, "lifeEvents"]);
      expect(cached).toBeUndefined();
    });
  });

  it("updateLifeEvent onMutate skips unknown entity ID", async () => {
    const existingLifeEvents = new Map([
      [
        "le-other",
        {
          id: "le-other",
          person_ids: ["p-1"],
          title: "Other LE",
          description: "other",
          category: "career" as const,
          approximate_date: "2000",
          impact: 3,
          tags: [],
        },
      ],
    ]);

    mockedApi.updateLifeEvent.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "lifeEvents"], existingLifeEvents);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateLifeEvent.mutate({
        lifeEventId: "le-nonexistent",
        personIds: ["p-1"],
        data: lifeEventData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>([
        "trees",
        TREE_ID,
        "lifeEvents",
      ]);
      expect(cached?.size).toBe(1);
      expect(cached?.has("le-other")).toBe(true);
      expect(cached?.has("le-nonexistent")).toBe(false);
    });
  });

  it("updateLifeEvent rolls back on error via onError", async () => {
    const existingLifeEvents = new Map([
      [
        "le-1",
        {
          id: "le-1",
          person_ids: ["p-1"],
          title: "Original LE",
          description: "orig",
          category: "career" as const,
          approximate_date: "2000",
          impact: 3,
          tags: [],
        },
      ],
    ]);

    mockedApi.updateLifeEvent.mockRejectedValue(new Error("network error"));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "lifeEvents"], existingLifeEvents);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updateLifeEvent.mutateAsync({
          lifeEventId: "le-1",
          personIds: ["p-1"],
          data: lifeEventData,
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>([
        "trees",
        TREE_ID,
        "lifeEvents",
      ]);
      const entry = cached?.get("le-1") as Record<string, unknown> | undefined;
      expect(entry?.title).toBe("Original LE");
    });
  });

  it("updateLifeEvent onError without previous context is a no-op", async () => {
    mockedApi.updateLifeEvent.mockRejectedValue(new Error("fail"));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updateLifeEvent.mutateAsync({
          lifeEventId: "le-1",
          personIds: ["p-1"],
          data: lifeEventData,
        });
      } catch {
        // expected
      }
    });

    const cached = queryClient.getQueryData(["trees", TREE_ID, "lifeEvents"]);
    expect(cached).toBeUndefined();
  });

  it("updateLifeEvent invalidates lifeEvents query on settled", async () => {
    mockedApi.updateLifeEvent.mockResolvedValue({
      id: "le-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updateLifeEvent.mutateAsync({
        lifeEventId: "le-1",
        personIds: ["p-1"],
        data: lifeEventData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "lifeEvents"],
    });
  });

  it("deleteLifeEvent calls api.deleteLifeEvent without encryption", async () => {
    mockedApi.deleteLifeEvent.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteLifeEvent.mutateAsync("le-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deleteLifeEvent).toHaveBeenCalledWith(TREE_ID, "le-1");
  });

  it("deleteLifeEvent invalidates lifeEvents query key on success", async () => {
    mockedApi.deleteLifeEvent.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deleteLifeEvent.mutateAsync("le-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "lifeEvents"],
    });
  });
});

// ---------------------------------------------------------------------------
// Classifications
// ---------------------------------------------------------------------------
describe("classification mutations", () => {
  const classificationData = {
    dsm_category: "neurodevelopmental",
    dsm_subcategory: "ADHD",
    status: "diagnosed" as const,
    diagnosis_year: 2020,
    periods: [{ start_year: 2020, end_year: null }],
    notes: null,
  };

  it("createClassification encrypts data then calls api.createClassification", async () => {
    mockedApi.createClassification.mockResolvedValue({
      id: "c-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createClassification.mutateAsync({
        personIds: ["p-1"],
        data: classificationData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(classificationData);
    expect(mockedApi.createClassification).toHaveBeenCalledWith(TREE_ID, {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("createClassification invalidates classifications query key on success", async () => {
    mockedApi.createClassification.mockResolvedValue({
      id: "c-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createClassification.mutateAsync({
        personIds: ["p-1"],
        data: classificationData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "classifications"],
    });
  });

  it("updateClassification encrypts data then calls api.updateClassification", async () => {
    mockedApi.updateClassification.mockResolvedValue({
      id: "c-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateClassification.mutateAsync({
        classificationId: "c-1",
        personIds: ["p-1"],
        data: classificationData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(classificationData);
    expect(mockedApi.updateClassification).toHaveBeenCalledWith(TREE_ID, "c-1", {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("updateClassification performs optimistic update via onMutate", async () => {
    const existingClassifications = new Map([
      [
        "c-1",
        {
          id: "c-1",
          person_ids: ["p-1"],
          dsm_category: "anxiety",
          dsm_subcategory: null,
          status: "suspected" as const,
          diagnosis_year: null,
          periods: [],
          notes: null,
        },
      ],
    ]);

    mockedApi.updateClassification.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "classifications"], existingClassifications);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateClassification.mutate({
        classificationId: "c-1",
        personIds: ["p-1", "p-2"],
        data: classificationData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>([
        "trees",
        TREE_ID,
        "classifications",
      ]);
      const entry = cached?.get("c-1") as Record<string, unknown> | undefined;
      expect(entry?.dsm_category).toBe("neurodevelopmental");
      expect(entry?.dsm_subcategory).toBe("ADHD");
      expect(entry?.status).toBe("diagnosed");
      expect(entry?.person_ids).toEqual(["p-1", "p-2"]);
    });
  });

  it("updateClassification onMutate handles empty cache gracefully", async () => {
    mockedApi.updateClassification.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateClassification.mutate({
        classificationId: "c-1",
        personIds: ["p-1"],
        data: classificationData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(["trees", TREE_ID, "classifications"]);
      expect(cached).toBeUndefined();
    });
  });

  it("updateClassification onMutate skips unknown entity ID", async () => {
    const existingClassifications = new Map([
      [
        "c-other",
        {
          id: "c-other",
          person_ids: ["p-1"],
          dsm_category: "anxiety",
          dsm_subcategory: null,
          status: "suspected" as const,
          diagnosis_year: null,
          periods: [],
          notes: null,
        },
      ],
    ]);

    mockedApi.updateClassification.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "classifications"], existingClassifications);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updateClassification.mutate({
        classificationId: "c-nonexistent",
        personIds: ["p-1"],
        data: classificationData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>([
        "trees",
        TREE_ID,
        "classifications",
      ]);
      expect(cached?.size).toBe(1);
      expect(cached?.has("c-other")).toBe(true);
      expect(cached?.has("c-nonexistent")).toBe(false);
    });
  });

  it("updateClassification rolls back on error via onError", async () => {
    const existingClassifications = new Map([
      [
        "c-1",
        {
          id: "c-1",
          person_ids: ["p-1"],
          dsm_category: "anxiety",
          dsm_subcategory: null,
          status: "suspected" as const,
          diagnosis_year: null,
          periods: [],
          notes: "original note",
        },
      ],
    ]);

    mockedApi.updateClassification.mockRejectedValue(new Error("network error"));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "classifications"], existingClassifications);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updateClassification.mutateAsync({
          classificationId: "c-1",
          personIds: ["p-1"],
          data: classificationData,
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>([
        "trees",
        TREE_ID,
        "classifications",
      ]);
      const entry = cached?.get("c-1") as Record<string, unknown> | undefined;
      expect(entry?.dsm_category).toBe("anxiety");
      expect(entry?.notes).toBe("original note");
    });
  });

  it("updateClassification onError without previous context is a no-op", async () => {
    mockedApi.updateClassification.mockRejectedValue(new Error("fail"));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updateClassification.mutateAsync({
          classificationId: "c-1",
          personIds: ["p-1"],
          data: classificationData,
        });
      } catch {
        // expected
      }
    });

    const cached = queryClient.getQueryData(["trees", TREE_ID, "classifications"]);
    expect(cached).toBeUndefined();
  });

  it("updateClassification invalidates classifications query on settled", async () => {
    mockedApi.updateClassification.mockResolvedValue({
      id: "c-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updateClassification.mutateAsync({
        classificationId: "c-1",
        personIds: ["p-1"],
        data: classificationData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "classifications"],
    });
  });

  it("deleteClassification calls api.deleteClassification without encryption", async () => {
    mockedApi.deleteClassification.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deleteClassification.mutateAsync("c-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deleteClassification).toHaveBeenCalledWith(TREE_ID, "c-1");
  });

  it("deleteClassification invalidates classifications query key on success", async () => {
    mockedApi.deleteClassification.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deleteClassification.mutateAsync("c-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "classifications"],
    });
  });
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------
describe("pattern mutations", () => {
  const patternData = {
    name: "Test Pattern",
    description: "desc",
    color: "#818cf8",
    linked_entities: [{ entity_type: "trauma_event" as const, entity_id: "e-1" }],
  };

  it("createPattern encrypts data then calls api.createPattern", async () => {
    mockedApi.createPattern.mockResolvedValue({
      id: "pat-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createPattern.mutateAsync({
        personIds: ["p-1"],
        data: patternData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(patternData);
    expect(mockedApi.createPattern).toHaveBeenCalledWith(TREE_ID, {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("createPattern invalidates patterns query key on success", async () => {
    mockedApi.createPattern.mockResolvedValue({
      id: "pat-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.createPattern.mutateAsync({
        personIds: ["p-1"],
        data: patternData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "patterns"],
    });
  });

  it("updatePattern encrypts data then calls api.updatePattern", async () => {
    mockedApi.updatePattern.mockResolvedValue({
      id: "pat-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updatePattern.mutateAsync({
        patternId: "pat-1",
        personIds: ["p-1"],
        data: patternData,
      });
    });

    expect(mockEncrypt).toHaveBeenCalledWith(patternData);
    expect(mockedApi.updatePattern).toHaveBeenCalledWith(TREE_ID, "pat-1", {
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });
  });

  it("updatePattern performs optimistic update via onMutate", async () => {
    const existingPatterns = new Map([
      [
        "pat-1",
        {
          id: "pat-1",
          person_ids: ["p-1"],
          name: "Old Pattern",
          description: "old",
          color: "#000000",
          linked_entities: [],
        },
      ],
    ]);

    mockedApi.updatePattern.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "patterns"], existingPatterns);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updatePattern.mutate({
        patternId: "pat-1",
        personIds: ["p-1", "p-2"],
        data: patternData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>(["trees", TREE_ID, "patterns"]);
      const entry = cached?.get("pat-1") as Record<string, unknown> | undefined;
      expect(entry?.name).toBe("Test Pattern");
      expect(entry?.person_ids).toEqual(["p-1", "p-2"]);
    });
  });

  it("updatePattern onMutate handles empty cache gracefully", async () => {
    mockedApi.updatePattern.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updatePattern.mutate({
        patternId: "pat-1",
        personIds: ["p-1"],
        data: patternData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(["trees", TREE_ID, "patterns"]);
      expect(cached).toBeUndefined();
    });
  });

  it("updatePattern onMutate skips unknown entity ID", async () => {
    const existingPatterns = new Map([
      [
        "pat-other",
        {
          id: "pat-other",
          person_ids: ["p-1"],
          name: "Other Pattern",
          description: "other",
          color: "#000000",
          linked_entities: [],
        },
      ],
    ]);

    mockedApi.updatePattern.mockReturnValue(new Promise(() => {}));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "patterns"], existingPatterns);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    act(() => {
      result.current.updatePattern.mutate({
        patternId: "pat-nonexistent",
        personIds: ["p-1"],
        data: patternData,
      });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>(["trees", TREE_ID, "patterns"]);
      expect(cached?.size).toBe(1);
      expect(cached?.has("pat-other")).toBe(true);
      expect(cached?.has("pat-nonexistent")).toBe(false);
    });
  });

  it("updatePattern rolls back on error via onError", async () => {
    const existingPatterns = new Map([
      [
        "pat-1",
        {
          id: "pat-1",
          person_ids: ["p-1"],
          name: "Original Pattern",
          description: "orig",
          color: "#000000",
          linked_entities: [],
        },
      ],
    ]);

    mockedApi.updatePattern.mockRejectedValue(new Error("network error"));

    const wrapper = createWrapper();
    queryClient.setQueryData(["trees", TREE_ID, "patterns"], existingPatterns);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updatePattern.mutateAsync({
          patternId: "pat-1",
          personIds: ["p-1"],
          data: patternData,
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<Map<string, unknown>>(["trees", TREE_ID, "patterns"]);
      const entry = cached?.get("pat-1") as Record<string, unknown> | undefined;
      expect(entry?.name).toBe("Original Pattern");
    });
  });

  it("updatePattern onError without previous context is a no-op", async () => {
    mockedApi.updatePattern.mockRejectedValue(new Error("fail"));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.updatePattern.mutateAsync({
          patternId: "pat-1",
          personIds: ["p-1"],
          data: patternData,
        });
      } catch {
        // expected
      }
    });

    const cached = queryClient.getQueryData(["trees", TREE_ID, "patterns"]);
    expect(cached).toBeUndefined();
  });

  it("updatePattern invalidates patterns query on settled", async () => {
    mockedApi.updatePattern.mockResolvedValue({
      id: "pat-1",
      tree_id: TREE_ID,
      person_ids: ["p-1"],
      encrypted_data: "encrypted-blob",
    });

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.updatePattern.mutateAsync({
        patternId: "pat-1",
        personIds: ["p-1"],
        data: patternData,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "patterns"],
    });
  });

  it("deletePattern calls api.deletePattern without encryption", async () => {
    mockedApi.deletePattern.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTreeMutations(TREE_ID), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.deletePattern.mutateAsync("pat-1");
    });

    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockedApi.deletePattern).toHaveBeenCalledWith(TREE_ID, "pat-1");
  });

  it("deletePattern invalidates patterns query key on success", async () => {
    mockedApi.deletePattern.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTreeMutations(TREE_ID), { wrapper });

    await act(async () => {
      await result.current.deletePattern.mutateAsync("pat-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["trees", TREE_ID, "patterns"],
    });
  });
});
