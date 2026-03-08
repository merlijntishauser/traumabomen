import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedJournalEntry,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "tree-123" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ state: null }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

vi.mock("../hooks/useTreeId", () => ({ useTreeId: () => "tree-123" }));

// Stable references to prevent infinite re-render loops
const EMPTY_PERSONS = new Map<string, DecryptedPerson>();
const EMPTY_RELATIONSHIPS = new Map<string, DecryptedRelationship>();
const EMPTY_EVENTS = new Map<string, DecryptedEvent>();
const EMPTY_LIFE_EVENTS = new Map<string, DecryptedLifeEvent>();
const EMPTY_TURNING_POINTS = new Map<string, DecryptedTurningPoint>();
const EMPTY_CLASSIFICATIONS = new Map<string, DecryptedClassification>();
const EMPTY_PATTERNS = new Map<string, DecryptedPattern>();
const EMPTY_SIBLING_GROUPS = new Map<string, DecryptedSiblingGroup>();
const EMPTY_JOURNAL_ENTRIES = new Map<string, DecryptedJournalEntry>();

const mockTreeData = {
  treeName: "Test Tree",
  persons: EMPTY_PERSONS,
  relationships: EMPTY_RELATIONSHIPS,
  events: EMPTY_EVENTS,
  lifeEvents: EMPTY_LIFE_EVENTS,
  turningPoints: EMPTY_TURNING_POINTS,
  classifications: EMPTY_CLASSIFICATIONS,
  patterns: EMPTY_PATTERNS,
  siblingGroups: EMPTY_SIBLING_GROUPS,
  journalEntries: EMPTY_JOURNAL_ENTRIES,
  isLoading: false,
  error: null as Error | null,
};

vi.mock("../hooks/useTreeData", () => ({
  useTreeData: () => mockTreeData,
  treeQueryKeys: {
    tree: (id: string) => ["trees", id],
    persons: (id: string) => ["trees", id, "persons"],
    relationships: (id: string) => ["trees", id, "relationships"],
    events: (id: string) => ["trees", id, "events"],
    lifeEvents: (id: string) => ["trees", id, "lifeEvents"],
    turningPoints: (id: string) => ["trees", id, "turningPoints"],
    classifications: (id: string) => ["trees", id, "classifications"],
    patterns: (id: string) => ["trees", id, "patterns"],
    siblingGroups: (id: string) => ["trees", id, "siblingGroups"],
    journalEntries: (id: string) => ["trees", id, "journalEntries"],
  },
  filterByPerson: () => [],
}));

vi.mock("../hooks/useTreeMutations", () => {
  function makeMockEntityMuts() {
    return {
      create: { mutate: vi.fn(), isPending: false },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    };
  }
  return {
    useTreeMutations: () => ({
      createPerson: { mutate: vi.fn(), isPending: false },
      updatePerson: { mutate: vi.fn() },
      deletePerson: { mutate: vi.fn() },
      createRelationship: { mutate: vi.fn() },
      updateRelationship: { mutate: vi.fn() },
      deleteRelationship: { mutate: vi.fn() },
      batchUpdatePersons: { mutate: vi.fn() },
      events: makeMockEntityMuts(),
      lifeEvents: makeMockEntityMuts(),
      turningPoints: makeMockEntityMuts(),
      classifications: makeMockEntityMuts(),
      patterns: makeMockEntityMuts(),
      siblingGroups: makeMockEntityMuts(),
      createJournalEntry: { mutate: vi.fn() },
      updateJournalEntry: { mutate: vi.fn() },
      deleteJournalEntry: { mutate: vi.fn() },
    }),
    linkedEntityHandlers: () => ({ save: vi.fn(), remove: vi.fn() }),
  };
});

const STABLE_CANVAS_SETTINGS = {
  showGrid: false,
  snapToGrid: false,
  edgeStyle: "curved" as const,
  showMarkers: true,
  showMinimap: false,
  promptRelationship: true,
  showReflectionPrompts: false,
  showParentEdges: true,
  showPartnerEdges: true,
  showSiblingEdges: true,
  showFriendEdges: true,
};

vi.mock("../hooks/useCanvasSettings", () => ({
  useCanvasSettings: () => ({
    settings: STABLE_CANVAS_SETTINGS,
    update: vi.fn(),
  }),
}));

const STABLE_TIMELINE_SETTINGS = {
  showPartnerLines: true,
  showPartnerLabels: true,
  showClassifications: true,
  showGridlines: false,
  showMarkerLabels: true,
};

vi.mock("../hooks/useTimelineSettings", () => ({
  useTimelineSettings: () => ({
    settings: STABLE_TIMELINE_SETTINGS,
    update: vi.fn(),
  }),
}));

// Stable filter references
const STABLE_EMPTY_DIMS = {
  dimmedPersonIds: new Set<string>(),
  dimmedEventIds: new Set<string>(),
  dimmedLifeEventIds: new Set<string>(),
  dimmedTurningPointIds: new Set<string>(),
  dimmedClassificationIds: new Set<string>(),
};

const STABLE_FILTERS = {
  visiblePersonIds: null as Set<string> | null,
  activeGroupKeys: new Set<string>(),
  traumaCategories: null as Set<string> | null,
  lifeEventCategories: null as Set<string> | null,
  classificationCategories: null as Set<string> | null,
  classificationSubcategories: null as Set<string> | null,
  classificationStatus: null as Set<string> | null,
  timeRange: null as { min: number; max: number } | null,
  visiblePatterns: null as Set<string> | null,
  filterMode: "dim" as const,
};

const mockFilterActions = {
  togglePerson: vi.fn(),
  toggleAllPersons: vi.fn(),
  togglePersonGroup: vi.fn(),
  toggleTraumaCategory: vi.fn(),
  toggleLifeEventCategory: vi.fn(),
  toggleClassificationCategory: vi.fn(),
  toggleClassificationSubcategory: vi.fn(),
  toggleClassificationStatus: vi.fn(),
  setTimeRange: vi.fn(),
  togglePatternFilter: vi.fn(),
  setFilterMode: vi.fn(),
  applyQuickFilter: vi.fn(),
  resetAll: vi.fn(),
  activeFilterCount: 0,
};

vi.mock("../hooks/useTimelineFilters", () => ({
  useTimelineFilters: () => ({
    filters: STABLE_FILTERS,
    actions: mockFilterActions,
    dims: STABLE_EMPTY_DIMS,
  }),
}));

vi.mock("../hooks/useWorkspacePanels", () => ({
  useWorkspacePanels: () => ({
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
  }),
}));

vi.mock("../hooks/useLinkedEntityPanelHandlers", () => ({
  useLinkedEntityPanelHandlers: () => ({
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
  }),
}));

vi.mock("../hooks/useSelectedPersonEntities", () => ({
  useSelectedPersonEntities: () => ({
    selectedRelationships: [],
    selectedEvents: [],
    selectedLifeEvents: [],
    selectedTurningPoints: [],
    selectedClassifications: [],
    inferredSiblings: [],
    selectedInferredSiblings: [],
  }),
}));

// Mock all child components
vi.mock("../components/tree/TreeToolbar", () => ({
  TreeToolbar: (props: Record<string, unknown>) => (
    <div
      data-testid="tree-toolbar"
      data-active-view={props.activeView as string}
      data-tree-name={props.treeName as string}
    >
      {props.children as React.ReactNode}
    </div>
  ),
}));

vi.mock("../components/tree/TimelineSettingsContent", () => ({
  TimelineSettingsContent: () => <div data-testid="timeline-settings" />,
}));

const mockTimelineViewOnSelectPerson = vi.fn();
const mockTimelineViewOnClickMarker = vi.fn();

vi.mock("../components/timeline/TimelineView", () => ({
  TimelineView: (props: Record<string, unknown>) => {
    // Capture the callbacks for testing
    mockTimelineViewOnSelectPerson.mockImplementation(props.onSelectPerson as () => void);
    mockTimelineViewOnClickMarker.mockImplementation(props.onClickMarker as () => void);
    return (
      <div
        data-testid="timeline-view"
        data-mode={props.mode as string}
        data-layout-mode={props.layoutMode as string}
        data-selected-person-id={props.selectedPersonId as string | null}
      />
    );
  },
}));

vi.mock("../components/timeline/timelineHelpers", () => ({
  computeGenerations: () => new Map(),
  computeTimeDomain: () => ({ min: 1900, max: 2025 }),
  filterTimelinePersons: () => [],
}));

vi.mock("../components/timeline/CreatePatternMiniForm", () => ({
  CreatePatternMiniForm: () => <div data-testid="create-pattern-form" />,
}));

vi.mock("../components/timeline/MarkerDetailCard", () => ({
  MarkerDetailCard: (props: Record<string, unknown>) => (
    <div data-testid="marker-detail-card">
      <button type="button" onClick={props.onClose as () => void}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../components/timeline/PersonSummaryCard", () => ({
  PersonSummaryCard: (props: Record<string, unknown>) => (
    <div data-testid="person-summary-card">
      <button type="button" onClick={props.onClose as () => void}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../components/timeline/TimelineChipBar", () => ({
  TimelineChipBar: () => <div data-testid="timeline-chip-bar" />,
}));

vi.mock("../components/timeline/TimelineFilterPanel", () => ({
  TimelineFilterPanel: (props: Record<string, unknown>) => (
    <div data-testid="timeline-filter-panel">
      <button type="button" onClick={props.onClose as () => void}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../components/WorkspacePanelHost", () => ({
  WorkspacePanelHost: () => <div data-testid="workspace-panel-host" />,
}));

vi.mock("../lib/patternEntities", () => ({
  derivePersonIds: () => [],
}));

vi.mock("../lib/smartFilterGroups", () => ({
  computeSmartFilterGroups: () => [],
}));

vi.mock("../components/tree/TreeCanvas.css", () => ({}));

// Import after all mocks
const { default: TimelinePage } = await import("./TimelinePage");

function resetTreeData() {
  mockTreeData.treeName = "Test Tree";
  mockTreeData.persons = EMPTY_PERSONS;
  mockTreeData.relationships = EMPTY_RELATIONSHIPS;
  mockTreeData.events = EMPTY_EVENTS;
  mockTreeData.lifeEvents = EMPTY_LIFE_EVENTS;
  mockTreeData.turningPoints = EMPTY_TURNING_POINTS;
  mockTreeData.classifications = EMPTY_CLASSIFICATIONS;
  mockTreeData.patterns = EMPTY_PATTERNS;
  mockTreeData.siblingGroups = EMPTY_SIBLING_GROUPS;
  mockTreeData.journalEntries = EMPTY_JOURNAL_ENTRIES;
  mockTreeData.isLoading = false;
  mockTreeData.error = null;
}

// ---- Tests ----

describe("TimelinePage", () => {
  beforeEach(() => {
    resetTreeData();
    mockFilterActions.activeFilterCount = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("basic rendering", () => {
    it("renders the tree toolbar with timeline active view", () => {
      render(<TimelinePage />);
      const toolbar = screen.getByTestId("tree-toolbar");
      expect(toolbar).toBeInTheDocument();
      expect(toolbar.getAttribute("data-active-view")).toBe("timeline");
    });

    it("renders the tree toolbar with tree name", () => {
      mockTreeData.treeName = "My Family Tree";
      render(<TimelinePage />);
      const toolbar = screen.getByTestId("tree-toolbar");
      expect(toolbar.getAttribute("data-tree-name")).toBe("My Family Tree");
    });

    it("renders the TimelineView component", () => {
      render(<TimelinePage />);
      expect(screen.getByTestId("timeline-view")).toBeInTheDocument();
    });

    it("renders workspace panel host", () => {
      render(<TimelinePage />);
      expect(screen.getByTestId("workspace-panel-host")).toBeInTheDocument();
    });
  });

  describe("loading and error states", () => {
    it("shows loading state", () => {
      mockTreeData.isLoading = true;
      render(<TimelinePage />);
      expect(screen.getByText("common.loading")).toBeInTheDocument();
    });

    it("does not render TimelineView while loading", () => {
      mockTreeData.isLoading = true;
      render(<TimelinePage />);
      expect(screen.queryByTestId("timeline-view")).not.toBeInTheDocument();
    });

    it("shows error state with decryption error message", () => {
      mockTreeData.error = new Error("decryption failed");
      render(<TimelinePage />);
      expect(screen.getByText("tree.decryptionError")).toBeInTheDocument();
    });

    it("still renders toolbar in error state", () => {
      mockTreeData.error = new Error("decryption failed");
      render(<TimelinePage />);
      expect(screen.getByTestId("tree-toolbar")).toBeInTheDocument();
    });

    it("does not render TimelineView in error state", () => {
      mockTreeData.error = new Error("decryption failed");
      render(<TimelinePage />);
      expect(screen.queryByTestId("timeline-view")).not.toBeInTheDocument();
    });
  });

  describe("layout mode controls", () => {
    it("renders layout mode buttons for years and age", () => {
      render(<TimelinePage />);
      expect(screen.getByText("timeline.years")).toBeInTheDocument();
      expect(screen.getByText("timeline.age")).toBeInTheDocument();
    });

    it("defaults to years layout mode", () => {
      render(<TimelinePage />);
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-layout-mode")).toBe("years");
    });

    it("switches to age layout mode when age button is clicked", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.age"));
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-layout-mode")).toBe("age");
    });

    it("switches back to years layout mode", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.age"));
      fireEvent.click(screen.getByText("timeline.years"));
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-layout-mode")).toBe("years");
    });
  });

  describe("interaction mode controls", () => {
    it("renders mode buttons for explore, edit, and annotate", () => {
      render(<TimelinePage />);
      expect(screen.getByText("timeline.explore")).toBeInTheDocument();
      expect(screen.getByText("timeline.edit")).toBeInTheDocument();
      expect(screen.getByText("timeline.annotate")).toBeInTheDocument();
    });

    it("defaults to explore mode", () => {
      render(<TimelinePage />);
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-mode")).toBe("explore");
    });

    it("switches to edit mode when edit button is clicked", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.edit"));
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-mode")).toBe("edit");
    });

    it("switches to annotate mode when annotate button is clicked", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.annotate"));
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-mode")).toBe("annotate");
    });

    it("switches back to explore mode", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.edit"));
      fireEvent.click(screen.getByText("timeline.explore"));
      const view = screen.getByTestId("timeline-view");
      expect(view.getAttribute("data-mode")).toBe("explore");
    });

    it("shows annotate hint when in annotate mode with no selections", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.annotate"));
      expect(screen.getByText("timeline.annotateHint")).toBeInTheDocument();
    });

    it("does not show annotate hint in explore mode", () => {
      render(<TimelinePage />);
      expect(screen.queryByText("timeline.annotateHint")).not.toBeInTheDocument();
    });
  });

  describe("toolbar buttons", () => {
    it("renders pattern visibility toggle button", () => {
      render(<TimelinePage />);
      const hideBtn = screen.getByLabelText("timeline.hidePatterns");
      expect(hideBtn).toBeInTheDocument();
    });

    it("toggles pattern visibility label when clicked", () => {
      render(<TimelinePage />);
      // Initially patterns are shown
      expect(screen.getByLabelText("timeline.hidePatterns")).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("timeline.hidePatterns"));
      // After toggle, patterns are hidden
      expect(screen.getByLabelText("timeline.showPatterns")).toBeInTheDocument();
    });

    it("renders filter button", () => {
      render(<TimelinePage />);
      expect(screen.getByLabelText("timeline.filter")).toBeInTheDocument();
    });

    it("opens filter panel when filter button is clicked", () => {
      render(<TimelinePage />);
      expect(screen.queryByTestId("timeline-filter-panel")).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("timeline.filter"));
      expect(screen.getByTestId("timeline-filter-panel")).toBeInTheDocument();
    });

    it("renders journal toggle button", () => {
      render(<TimelinePage />);
      expect(screen.getByLabelText("journal.tab")).toBeInTheDocument();
    });
  });

  describe("filter chip bar", () => {
    it("does not show chip bar when no active filters", () => {
      render(<TimelinePage />);
      expect(screen.queryByTestId("timeline-chip-bar")).not.toBeInTheDocument();
    });

    it("shows chip bar when there are active filters", () => {
      mockFilterActions.activeFilterCount = 2;
      render(<TimelinePage />);
      expect(screen.getByTestId("timeline-chip-bar")).toBeInTheDocument();
    });

    it("shows filter badge count on filter button", () => {
      mockFilterActions.activeFilterCount = 3;
      render(<TimelinePage />);
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts", () => {
    it("Escape key does not crash the component", () => {
      render(<TimelinePage />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByTestId("timeline-view")).toBeInTheDocument();
    });

    it("Escape key closes filter panel when open", () => {
      render(<TimelinePage />);
      // Open filter panel
      fireEvent.click(screen.getByLabelText("timeline.filter"));
      expect(screen.getByTestId("timeline-filter-panel")).toBeInTheDocument();
      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByTestId("timeline-filter-panel")).not.toBeInTheDocument();
    });

    it("Escape exits edit mode back to explore", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.edit"));
      expect(screen.getByTestId("timeline-view").getAttribute("data-mode")).toBe("edit");
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByTestId("timeline-view").getAttribute("data-mode")).toBe("explore");
    });

    it("Escape exits annotate mode back to explore", () => {
      render(<TimelinePage />);
      fireEvent.click(screen.getByText("timeline.annotate"));
      expect(screen.getByTestId("timeline-view").getAttribute("data-mode")).toBe("annotate");
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByTestId("timeline-view").getAttribute("data-mode")).toBe("explore");
    });
  });
});
