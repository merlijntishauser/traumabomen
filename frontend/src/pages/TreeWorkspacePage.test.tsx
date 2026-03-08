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
}));

vi.mock("@xyflow/react", () => {
  const ReactFlow = (props: Record<string, unknown>) => {
    const { nodes, edges, onPaneClick, onNodeClick, onEdgeClick, onConnect, children } = props as {
      nodes: unknown[];
      edges: unknown[];
      onPaneClick?: () => void;
      onNodeClick?: (event: unknown, node: unknown) => void;
      onEdgeClick?: (event: unknown, edge: unknown) => void;
      onConnect?: (connection: unknown) => void;
      children?: React.ReactNode;
    };
    return (
      <div
        data-testid="react-flow"
        data-node-count={nodes?.length ?? 0}
        data-edge-count={edges?.length ?? 0}
      >
        <button type="button" data-testid="trigger-pane-click" onClick={() => onPaneClick?.()} />
        <button
          type="button"
          data-testid="trigger-node-click"
          onClick={() =>
            onNodeClick?.({ target: document.createElement("div") }, { id: "p1", type: "person" })
          }
        />
        <button
          type="button"
          data-testid="trigger-edge-click"
          onClick={() => onEdgeClick?.({}, { id: "r1", type: "relationship" })}
        />
        <button
          type="button"
          data-testid="trigger-connect"
          onClick={() =>
            onConnect?.({ source: "p1", target: "p2", sourceHandle: null, targetHandle: null })
          }
        />
        {children}
      </div>
    );
  };
  return {
    ReactFlow,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow-provider">{children}</div>
    ),
    useReactFlow: () => ({
      fitView: vi.fn(),
      screenToFlowPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    }),
    applyNodeChanges: (_changes: unknown, nodes: unknown[]) => nodes,
    Background: () => <div data-testid="rf-background" />,
    Controls: () => <div data-testid="rf-controls" />,
    MiniMap: () => <div data-testid="rf-minimap" />,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    Handle: () => null,
  };
});

vi.mock("@xyflow/react/dist/style.css", () => ({}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

vi.mock("../hooks/useTreeId", () => ({ useTreeId: () => "tree-123" }));

// Use stable references to avoid infinite re-render loops
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

const mockCreatePersonMutate = vi.fn();

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
      createPerson: { mutate: mockCreatePersonMutate, isPending: false },
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

// Stable references for layout return
const STABLE_LAYOUT_NODES: unknown[] = [];
const STABLE_LAYOUT_EDGES: unknown[] = [];

vi.mock("../hooks/useTreeLayout", () => ({
  useTreeLayout: () => ({ nodes: STABLE_LAYOUT_NODES, edges: STABLE_LAYOUT_EDGES }),
  filterEdgesByVisibility: () => STABLE_LAYOUT_EDGES,
}));

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

vi.mock("../hooks/usePositionHistory", () => ({
  usePositionHistory: () => ({ canUndo: false, push: vi.fn(), pop: vi.fn() }),
}));

vi.mock("../hooks/useExportTree", () => ({
  useExportTree: () => ({ exportEncrypted: vi.fn(), exportPlaintext: vi.fn() }),
}));

vi.mock("../hooks/usePromoteMember", () => ({
  usePromoteMember: () => ({ mutate: vi.fn() }),
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
vi.mock("../components/tree/BranchDecoration", () => ({
  BranchDecoration: () => <div data-testid="branch-decoration" />,
}));

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

vi.mock("../components/tree/CanvasToolbarButtons", () => ({
  CanvasToolbarButtons: (props: Record<string, unknown>) => (
    <div data-testid="canvas-toolbar-buttons">
      <button
        type="button"
        data-testid="add-person-btn"
        onClick={props.onAddPerson as () => void}
        disabled={props.isAddingPerson as boolean}
      >
        Add Person
      </button>
    </div>
  ),
}));

vi.mock("../components/tree/CanvasSettingsContent", () => ({
  CanvasSettingsContent: () => <div data-testid="canvas-settings" />,
}));

vi.mock("../components/tree/PatternConnectors", () => ({
  PatternConnectors: () => <div data-testid="pattern-connectors" />,
}));

vi.mock("../components/tree/PersonNode", () => ({
  PersonNode: () => <div data-testid="person-node" />,
}));

vi.mock("../components/tree/ReflectionNudge", () => ({
  ReflectionNudge: () => <div data-testid="reflection-nudge" />,
}));

vi.mock("../components/tree/RelationshipDetailPanel", () => ({
  RelationshipDetailPanel: () => <div data-testid="relationship-detail-panel" />,
}));

vi.mock("../components/tree/RelationshipEdge", () => ({
  RelationshipEdge: () => <div data-testid="relationship-edge" />,
}));

vi.mock("../components/tree/RelationshipPopover", () => ({
  RelationshipPopover: () => <div data-testid="relationship-popover" />,
}));

vi.mock("../components/tree/RelationshipPrompt", () => ({
  RelationshipPrompt: () => <div data-testid="relationship-prompt" />,
}));

vi.mock("../components/tree/SiblingGroupNode", () => ({
  default: () => <div data-testid="sibling-group-node" />,
}));

vi.mock("../components/tree/SiblingGroupPanel", () => ({
  SiblingGroupPanel: () => <div data-testid="sibling-group-panel" />,
}));

vi.mock("../components/WorkspacePanelHost", () => ({
  WorkspacePanelHost: () => <div data-testid="workspace-panel-host" />,
}));

vi.mock("../components/tree/TreeCanvas.css", () => ({}));

// Import after all mocks
const { default: TreeWorkspacePage } = await import("./TreeWorkspacePage");

// ---- Helpers ----

function makePerson(id: string, overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id,
    name: `Person ${id}`,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "unknown",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

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

describe("TreeWorkspacePage", () => {
  beforeEach(() => {
    resetTreeData();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders within ReactFlowProvider", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("react-flow-provider")).toBeInTheDocument();
  });

  it("renders the tree toolbar with canvas active view", () => {
    render(<TreeWorkspacePage />);
    const toolbar = screen.getByTestId("tree-toolbar");
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.getAttribute("data-active-view")).toBe("canvas");
  });

  it("renders the tree toolbar with tree name", () => {
    mockTreeData.treeName = "My Family Tree";
    render(<TreeWorkspacePage />);
    const toolbar = screen.getByTestId("tree-toolbar");
    expect(toolbar.getAttribute("data-tree-name")).toBe("My Family Tree");
  });

  it("renders the ReactFlow canvas", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("renders canvas toolbar buttons", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("canvas-toolbar-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("add-person-btn")).toBeInTheDocument();
  });

  it("renders pattern connectors overlay", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("pattern-connectors")).toBeInTheDocument();
  });

  it("renders workspace panel host", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("workspace-panel-host")).toBeInTheDocument();
  });

  it("renders branch decoration when grid is off", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("branch-decoration")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockTreeData.isLoading = true;
    render(<TreeWorkspacePage />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("does not render ReactFlow while loading", () => {
    mockTreeData.isLoading = true;
    render(<TreeWorkspacePage />);
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });

  it("shows error state with decryption error message", () => {
    mockTreeData.error = new Error("decryption failed");
    render(<TreeWorkspacePage />);
    expect(screen.getByText("tree.decryptionError")).toBeInTheDocument();
  });

  it("still renders toolbar in error state", () => {
    mockTreeData.error = new Error("decryption failed");
    render(<TreeWorkspacePage />);
    expect(screen.getByTestId("tree-toolbar")).toBeInTheDocument();
  });

  it("does not render ReactFlow in error state", () => {
    mockTreeData.error = new Error("decryption failed");
    render(<TreeWorkspacePage />);
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });

  it("shows empty state when no persons exist and not loading", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByText("tree.canvasEmpty")).toBeInTheDocument();
    expect(screen.getByText("tree.canvasEmptyHint")).toBeInTheDocument();
  });

  it("shows add person button in empty state", () => {
    render(<TreeWorkspacePage />);
    expect(screen.getByText("tree.addPerson")).toBeInTheDocument();
  });

  it("does not show empty state when persons exist", () => {
    mockTreeData.persons = new Map([["p1", makePerson("p1")]]);
    render(<TreeWorkspacePage />);
    expect(screen.queryByText("tree.canvasEmpty")).not.toBeInTheDocument();
  });

  it("does not show empty state while loading", () => {
    mockTreeData.isLoading = true;
    render(<TreeWorkspacePage />);
    expect(screen.queryByText("tree.canvasEmpty")).not.toBeInTheDocument();
  });

  it("calls createPerson.mutate when add person toolbar button is clicked", () => {
    render(<TreeWorkspacePage />);
    fireEvent.click(screen.getByTestId("add-person-btn"));
    expect(mockCreatePersonMutate).toHaveBeenCalledTimes(1);
    const calledWith = mockCreatePersonMutate.mock.calls[0][0];
    expect(calledWith).toHaveProperty("name", "person.newPerson");
    expect(calledWith).toHaveProperty("gender", "other");
    expect(calledWith).toHaveProperty("is_adopted", false);
    expect(calledWith).toHaveProperty("position");
  });

  it("calls createPerson.mutate when empty state button is clicked", () => {
    render(<TreeWorkspacePage />);
    fireEvent.click(screen.getByText("tree.addPerson"));
    expect(mockCreatePersonMutate).toHaveBeenCalledTimes(1);
  });

  it("Escape key does not crash the component", () => {
    render(<TreeWorkspacePage />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });
});
