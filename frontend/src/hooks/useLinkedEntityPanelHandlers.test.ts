import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLinkedEntityPanelHandlers } from "./useLinkedEntityPanelHandlers";
import type { useTreeMutations } from "./useTreeMutations";

function createMockMutations(): ReturnType<typeof useTreeMutations> {
  const makeMutation = () => ({ mutate: vi.fn() });
  const makeGroup = () => ({
    create: makeMutation(),
    update: makeMutation(),
    delete: makeMutation(),
  });
  return {
    createPerson: makeMutation(),
    updatePerson: makeMutation(),
    batchUpdatePersons: makeMutation(),
    deletePerson: makeMutation(),
    createRelationship: makeMutation(),
    updateRelationship: makeMutation(),
    deleteRelationship: makeMutation(),
    events: makeGroup(),
    lifeEvents: makeGroup(),
    turningPoints: makeGroup(),
    classifications: makeGroup(),
    patterns: makeGroup(),
    createJournalEntry: makeMutation(),
    updateJournalEntry: makeMutation(),
    deleteJournalEntry: makeMutation(),
  } as unknown as ReturnType<typeof useTreeMutations>;
}

describe("useLinkedEntityPanelHandlers", () => {
  it("handleSavePerson calls updatePerson.mutate with selected person id", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    const personData = { name: "Alice" } as Parameters<typeof result.current.handleSavePerson>[0];
    result.current.handleSavePerson(personData);
    expect(mutations.updatePerson.mutate).toHaveBeenCalledWith(
      { personId: "p1", data: personData },
      undefined,
    );
  });

  it("handleSavePerson does nothing when selectedPersonId is null", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: null,
      }),
    );
    result.current.handleSavePerson({ name: "Alice" } as Parameters<
      typeof result.current.handleSavePerson
    >[0]);
    expect(mutations.updatePerson.mutate).not.toHaveBeenCalled();
  });

  it("handleSavePerson passes onSuccess when onPersonSaved is provided", () => {
    const mutations = createMockMutations();
    const onPersonSaved = vi.fn();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
        onPersonSaved,
      }),
    );
    result.current.handleSavePerson({ name: "Alice" } as Parameters<
      typeof result.current.handleSavePerson
    >[0]);
    expect(mutations.updatePerson.mutate).toHaveBeenCalledWith(expect.any(Object), {
      onSuccess: onPersonSaved,
    });
  });

  it("handleDeletePerson calls deletePerson.mutate and triggers callback", () => {
    const mutations = createMockMutations();
    const onPersonDeleted = vi.fn();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
        onPersonDeleted,
      }),
    );
    result.current.handleDeletePerson("p1");
    expect(mutations.deletePerson.mutate).toHaveBeenCalledWith("p1", {
      onSuccess: expect.any(Function),
    });
    // Simulate onSuccess
    const call = (mutations.deletePerson.mutate as ReturnType<typeof vi.fn>).mock.calls[0];
    call[1].onSuccess();
    expect(onPersonDeleted).toHaveBeenCalled();
  });

  it("handleSaveRelationship calls updateRelationship.mutate", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    const relData = { type: "partner" } as Parameters<
      typeof result.current.handleSaveRelationship
    >[1];
    result.current.handleSaveRelationship("r1", relData);
    expect(mutations.updateRelationship.mutate).toHaveBeenCalledWith({
      relationshipId: "r1",
      data: relData,
    });
  });

  it("eventHandlers.save creates new event when id is null", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    const data = { title: "test" };
    result.current.eventHandlers.save(null, data, ["p1"]);
    expect(mutations.events.create.mutate).toHaveBeenCalledWith({
      personIds: ["p1"],
      data,
    });
  });

  it("eventHandlers.save updates existing event when id is provided", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    const data = { title: "test" };
    result.current.eventHandlers.save("e1", data, ["p1"]);
    expect(mutations.events.update.mutate).toHaveBeenCalledWith({
      entityId: "e1",
      personIds: ["p1"],
      data,
    });
  });

  it("eventHandlers.remove calls delete", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    result.current.eventHandlers.remove("e1");
    expect(mutations.events.delete.mutate).toHaveBeenCalledWith("e1");
  });

  it("handleSaveJournalEntry creates when entryId is null", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    const data = { text: "journal text", linked_entities: [] } as Parameters<
      typeof result.current.handleSaveJournalEntry
    >[1];
    result.current.handleSaveJournalEntry(null, data);
    expect(mutations.createJournalEntry.mutate).toHaveBeenCalledWith(data);
  });

  it("handleSaveJournalEntry updates when entryId is provided", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    const data = { text: "updated", linked_entities: [] } as Parameters<
      typeof result.current.handleSaveJournalEntry
    >[1];
    result.current.handleSaveJournalEntry("j1", data);
    expect(mutations.updateJournalEntry.mutate).toHaveBeenCalledWith({
      entryId: "j1",
      data,
    });
  });

  it("handleDeleteJournalEntry calls deleteJournalEntry.mutate", () => {
    const mutations = createMockMutations();
    const { result } = renderHook(() =>
      useLinkedEntityPanelHandlers({
        mutations,
        selectedPersonId: "p1",
      }),
    );
    result.current.handleDeleteJournalEntry("j1");
    expect(mutations.deleteJournalEntry.mutate).toHaveBeenCalledWith("j1");
  });
});
