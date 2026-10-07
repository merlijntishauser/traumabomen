import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimelinePage from "./TimelinePage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("../hooks/useTreeId", () => ({ useTreeId: () => "tree-1" }));

const treeData = {
  treeName: "Whitfields",
  persons: new Map(),
  relationships: new Map(),
  events: new Map(),
  lifeEvents: new Map(),
  turningPoints: new Map(),
  classifications: new Map(),
  patterns: new Map([["p1", { id: "p1" }]]),
  isLoading: false,
  error: null as Error | null,
};
vi.mock("../hooks/useTreeData", () => ({ useTreeData: () => treeData }));
vi.mock("../hooks/useTreeMutations", () => ({ useTreeMutations: () => ({}) }));
vi.mock("../hooks/useCanvasSettings", () => ({
  useCanvasSettings: () => ({ settings: { showReflectionPrompts: true } }),
}));
vi.mock("../hooks/useLinkedEntityPanelHandlers", () => ({
  useLinkedEntityPanelHandlers: () => ({}),
}));
vi.mock("../hooks/useSelectedPersonEntities", () => ({
  useSelectedPersonEntities: () => ({}),
}));
vi.mock("../lib/userFacingErrors", () => ({ treeLoadErrorKey: () => "tree.loadError" }));

vi.mock("../components/tree/TreeToolbar", () => ({
  TreeToolbar: ({ children, viewTab }: { children: ReactNode; viewTab: { label: string } }) => (
    <div data-testid="toolbar" data-tab={viewTab.label}>
      {children}
    </div>
  ),
}));
vi.mock("../components/tree/ThemeLanguageSettings", () => ({ ThemeLanguageSettings: () => null }));

interface HostProps {
  panels: {
    selectedPersonId: string | null;
    initialSection: string | null;
    journalPanelOpen: boolean;
  };
  initialEntityId?: string;
  visiblePatternIds: Set<string>;
  showPersonPanel?: boolean;
}
let host: HostProps;
vi.mock("../components/WorkspacePanelHost", () => ({
  WorkspacePanelHost: (props: HostProps) => {
    host = props;
    return null;
  },
}));

vi.mock("../components/familyStripes/FamilyStripesView", () => ({
  FamilyStripesView: (props: {
    onOpenPerson: (id: string) => void;
    onOpenEntry: (entry: { id: string; kind: string }, personId: string) => void;
  }) => (
    <div data-testid="stripes">
      <button type="button" onClick={() => props.onOpenPerson("ada")}>
        open person
      </button>
      <button
        type="button"
        onClick={() => props.onOpenEntry({ id: "e1", kind: "trauma_event" }, "ada")}
      >
        open entry
      </button>
    </div>
  ),
}));

beforeEach(() => {
  treeData.isLoading = false;
  treeData.error = null;
});

describe("TimelinePage", () => {
  it("shows the family stripes under the toolbar with the person page available", () => {
    render(<TimelinePage />);
    expect(screen.getByTestId("stripes")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).toHaveAttribute("data-tab", "settings.timeline");
    expect(host.showPersonPanel).toBe(true);
    expect([...host.visiblePatternIds]).toEqual(["p1"]);
  });

  it("opens a person's page, or one entry's form on it", () => {
    render(<TimelinePage />);
    fireEvent.click(screen.getByText("open entry"));
    expect(host.panels.selectedPersonId).toBe("ada");
    expect(host.panels.initialSection).toBe("trauma_event");
    expect(host.initialEntityId).toBe("e1");
    fireEvent.click(screen.getByText("open person"));
    expect(host.panels.initialSection).toBe("person");
    expect(host.initialEntityId).toBeUndefined();
  });

  it("toggles the journal and closes panels with Escape, topmost first", () => {
    render(<TimelinePage />);
    fireEvent.click(screen.getByText("open person"));
    const journal = screen.getByRole("button", { name: "journal.tab" });
    fireEvent.click(journal);
    expect(journal).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(host.panels.journalPanelOpen).toBe(false);
    expect(host.panels.selectedPersonId).toBe("ada");
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(host.panels.selectedPersonId).toBeNull();
  });

  it("shows loading text while the tree decrypts", () => {
    treeData.isLoading = true;
    render(<TimelinePage />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("stripes")).not.toBeInTheDocument();
  });

  it("shows the load error instead of the view", () => {
    treeData.error = new Error("nope");
    render(<TimelinePage />);
    expect(screen.getByText("tree.loadError")).toBeInTheDocument();
    expect(screen.queryByTestId("stripes")).not.toBeInTheDocument();
  });
});
