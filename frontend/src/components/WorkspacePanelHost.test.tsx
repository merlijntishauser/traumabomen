import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { useLinkedEntityPanelHandlers } from "../hooks/useLinkedEntityPanelHandlers";
import type { SelectedPersonEntities } from "../hooks/useSelectedPersonEntities";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedJournalEntry,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
  useTreeData,
} from "../hooks/useTreeData";
import type { WorkspacePanelState } from "../hooks/useWorkspacePanels";
import { WorkspacePanelHost } from "./WorkspacePanelHost";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key} (${opts.count})`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock("../lib/reflectionPrompts", () => ({
  getRandomJournalPrompts: () => ["Prompt 1"],
  getPersonPrompt: () => "Person reflection prompt",
}));

const emptyMaps = {
  persons: new Map<string, DecryptedPerson>(),
  relationships: new Map<string, DecryptedRelationship>(),
  events: new Map<string, DecryptedEvent>(),
  lifeEvents: new Map<string, DecryptedLifeEvent>(),
  turningPoints: new Map<string, DecryptedTurningPoint>(),
  classifications: new Map<string, DecryptedClassification>(),
  patterns: new Map<string, DecryptedPattern>(),
  journalEntries: new Map<string, DecryptedJournalEntry>(),
};

function createMockTreeData(): ReturnType<typeof useTreeData> {
  return {
    treeName: "Test Tree",
    ...emptyMaps,
    isLoading: false,
    error: null,
  };
}

function createMockPanels(overrides?: Partial<WorkspacePanelState>): WorkspacePanelState {
  return {
    selectedPersonId: null,
    setSelectedPersonId: vi.fn(),
    patternPanelOpen: false,
    setPatternPanelOpen: vi.fn(),
    journalPanelOpen: false,
    setJournalPanelOpen: vi.fn(),
    journalInitialPrompt: "",
    journalInitialLinkedRef: undefined,
    openJournal: vi.fn(),
    hoveredPatternId: null,
    setHoveredPatternId: vi.fn(),
    initialSection: null,
    setInitialSection: vi.fn(),
    ...overrides,
  };
}

function createMockHandlers(): ReturnType<typeof useLinkedEntityPanelHandlers> {
  return {
    handleSavePerson: vi.fn(),
    handleDeletePerson: vi.fn(),
    handleSaveRelationship: vi.fn(),
    eventHandlers: { save: vi.fn(), remove: vi.fn() },
    lifeEventHandlers: { save: vi.fn(), remove: vi.fn() },
    turningPointHandlers: { save: vi.fn(), remove: vi.fn() },
    classificationHandlers: { save: vi.fn(), remove: vi.fn() },
    patternHandlers: { save: vi.fn(), remove: vi.fn() },
    handleSaveJournalEntry: vi.fn(),
    handleDeleteJournalEntry: vi.fn(),
  };
}

function createMockEntities(): SelectedPersonEntities {
  return {
    selectedRelationships: [],
    selectedEvents: [],
    selectedLifeEvents: [],
    selectedTurningPoints: [],
    selectedClassifications: [],
    inferredSiblings: [],
    selectedInferredSiblings: [],
  };
}

describe("WorkspacePanelHost", () => {
  it("renders nothing when all panels are closed and no person selected", () => {
    const { container } = render(
      <WorkspacePanelHost
        panels={createMockPanels()}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={createMockTreeData()}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders PersonDetailPanel when person is selected and showPersonPanel is true", () => {
    const persons = new Map<string, DecryptedPerson>([
      [
        "p1",
        {
          id: "p1",
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
        } as DecryptedPerson,
      ],
    ]);
    const treeData = { ...createMockTreeData(), persons };
    render(
      <WorkspacePanelHost
        panels={createMockPanels({ selectedPersonId: "p1" })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={treeData}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("does not render PersonDetailPanel when showPersonPanel is false", () => {
    const persons = new Map<string, DecryptedPerson>([
      [
        "p1",
        {
          id: "p1",
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
        } as DecryptedPerson,
      ],
    ]);
    const treeData = { ...createMockTreeData(), persons };
    const { container } = render(
      <WorkspacePanelHost
        panels={createMockPanels({ selectedPersonId: "p1" })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={treeData}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
        showPersonPanel={false}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders PatternPanel when patternPanelOpen is true", () => {
    render(
      <WorkspacePanelHost
        panels={createMockPanels({ patternPanelOpen: true })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={createMockTreeData()}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    expect(screen.getByText("pattern.patterns")).toBeInTheDocument();
  });

  it("renders JournalPanel when journalPanelOpen is true", () => {
    render(
      <WorkspacePanelHost
        panels={createMockPanels({ journalPanelOpen: true })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={createMockTreeData()}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    expect(screen.getByText("journal.title")).toBeInTheDocument();
  });

  it("calls setSelectedPersonId(null) when PersonDetailPanel close is clicked", () => {
    const setSelectedPersonId = vi.fn();
    const persons = new Map<string, DecryptedPerson>([
      [
        "p1",
        {
          id: "p1",
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
        } as DecryptedPerson,
      ],
    ]);
    const treeData = { ...createMockTreeData(), persons };
    const { container } = render(
      <WorkspacePanelHost
        panels={createMockPanels({ selectedPersonId: "p1", setSelectedPersonId })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={treeData}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    const closeBtn = container.querySelector(".panel-close");
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    expect(setSelectedPersonId).toHaveBeenCalledWith(null);
  });

  it("calls setPatternPanelOpen(false) when PatternPanel close is clicked", () => {
    const setPatternPanelOpen = vi.fn();
    const { container } = render(
      <WorkspacePanelHost
        panels={createMockPanels({ patternPanelOpen: true, setPatternPanelOpen })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={createMockTreeData()}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    const closeBtn = container.querySelector(".panel-close");
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    expect(setPatternPanelOpen).toHaveBeenCalledWith(false);
  });

  it("calls setJournalPanelOpen(false) when JournalPanel close is clicked", () => {
    const setJournalPanelOpen = vi.fn();
    const { container } = render(
      <WorkspacePanelHost
        panels={createMockPanels({ journalPanelOpen: true, setJournalPanelOpen })}
        handlers={createMockHandlers()}
        entities={createMockEntities()}
        treeData={createMockTreeData()}
        visiblePatternIds={new Set()}
        onTogglePatternVisibility={vi.fn()}
        showReflectionPrompts={false}
      />,
    );
    const closeBtn = container.querySelector(".panel-close");
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    expect(setJournalPanelOpen).toHaveBeenCalledWith(false);
  });
});
