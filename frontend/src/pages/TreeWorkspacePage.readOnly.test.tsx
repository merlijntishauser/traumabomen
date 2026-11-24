import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EncryptionContext } from "../contexts/EncryptionContext";
import type { DecryptedPerson } from "../hooks/useTreeData";
import * as api from "../lib/api";
import type { SharedTreeInfo } from "../lib/sharingLoader";

// A workspace that is close to the real one: the real toolbar, rail, panels,
// mutations and React Query, with only the network, the canvas library and
// a few heavy leaves replaced. Read-only must hold at the request level, so
// every API call that writes is a spy that must never be called.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts && typeof opts.owner === "string" ? `${k}:${opts.owner}` : k,
    i18n: { language: "en" },
  }),
}));

const TREE_ID = vi.hoisted(() => "03f28958-029f-4663-82e3-4de766986d28");
const WRITE_PREFIX = vi.hoisted(
  () => /^(create|update|delete|sync|put|complete|modify|migrate|batch)/,
);

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const mocked: Record<string, unknown> = { ...actual };
  for (const [name, value] of Object.entries(actual)) {
    if (typeof value === "function" && WRITE_PREFIX.test(name)) {
      mocked[name] = vi.fn().mockResolvedValue({ id: "created" });
    }
  }
  return mocked;
});

vi.mock("@xyflow/react", () => {
  const ReactFlow = (props: Record<string, unknown>) => {
    const node = { id: "p1", type: "person", position: { x: 40, y: 40 } };
    const call = (name: string, ...args: unknown[]) =>
      (props[name] as ((...a: unknown[]) => void) | undefined)?.(...args);
    return (
      <div
        data-testid="react-flow"
        data-draggable={String(props.nodesDraggable)}
        data-connectable={String(props.nodesConnectable)}
        data-context-menu={String(typeof props.onNodeContextMenu === "function")}
      >
        <button
          type="button"
          data-testid="trigger-node-click"
          onClick={() => call("onNodeClick", { target: document.createElement("div") }, node)}
        />
        {/* Fires the drag callbacks whatever nodesDraggable says, so the
            handlers themselves are tested too. */}
        <button
          type="button"
          data-testid="trigger-node-drag"
          onClick={() => {
            call("onNodeDragStart", {}, node);
            call("onNodeDragStop", {}, { ...node, position: { x: 300, y: 300 } });
          }}
        />
        <button
          type="button"
          data-testid="trigger-connect"
          onClick={() =>
            call("onConnect", {
              source: "p1",
              target: "p2",
              sourceHandle: null,
              targetHandle: null,
            })
          }
        />
        {props.children as ReactNode}
      </div>
    );
  };
  return {
    ReactFlow,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useReactFlow: () => ({ fitView: vi.fn(), screenToFlowPosition: () => ({ x: 0, y: 0 }) }),
    useUpdateNodeInternals: () => vi.fn(),
    applyNodeChanges: (_changes: unknown, nodes: unknown[]) => nodes,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    Handle: () => null,
  };
});
vi.mock("@xyflow/react/dist/style.css", () => ({}));
vi.mock("../components/tree/TreeCanvas.css", () => ({}));

vi.mock("../hooks/useTreeId", () => ({ useTreeId: () => TREE_ID }));

function person(id: string, name: string): DecryptedPerson {
  return {
    id,
    name,
    birth_year: 1950,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    position: { x: 40, y: 40 },
  };
}

const PERSONS = new Map([
  ["p1", person("p1", "Grandmother")],
  ["p2", person("p2", "Grandfather")],
]);
const EMPTY = new Map();
const treeData = {
  treeName: "Shared family",
  persons: PERSONS,
  relationships: EMPTY,
  events: EMPTY,
  lifeEvents: EMPTY,
  turningPoints: EMPTY,
  classifications: EMPTY,
  patterns: EMPTY,
  siblingGroups: EMPTY,
  journalEntries: EMPTY,
  isLoading: false,
  error: null as Error | null,
};

vi.mock("../hooks/useTreeData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useTreeData")>();
  return { ...actual, useTreeData: () => treeData };
});

const LAYOUT_NODES = [
  { id: "p1", type: "person", position: { x: 40, y: 40 }, data: {} },
  { id: "p2", type: "person", position: { x: 300, y: 40 }, data: {} },
];
const LAYOUT_EDGES: unknown[] = [];
vi.mock("../hooks/useTreeLayout", () => ({
  useTreeLayout: () => ({ nodes: LAYOUT_NODES, edges: LAYOUT_EDGES }),
  filterEdgesByVisibility: () => LAYOUT_EDGES,
}));

const CANVAS_SETTINGS = {
  showGrid: false,
  snapToGrid: false,
  edgeStyle: "curved" as const,
  showMarkers: true,
  showMinimap: false,
  promptRelationship: true,
  showReflectionPrompts: true,
  showParentEdges: true,
  showPartnerEdges: true,
  showSiblingEdges: true,
  showFriendEdges: true,
  autoLockMinutes: 0,
};
vi.mock("../hooks/useCanvasSettings", () => ({
  useCanvasSettings: () => ({ settings: CANVAS_SETTINGS, update: vi.fn() }),
}));

vi.mock("../hooks/useLogout", () => ({ useLogout: () => vi.fn() }));
// The canvas view tab is rendered inline so its export actions can be checked.
vi.mock("../components/tree/SettingsPanel", () => ({
  SettingsPanel: ({ viewTab }: { viewTab: { content: ReactNode } }) => (
    <div data-testid="settings-view-tab">{viewTab.content}</div>
  ),
}));
vi.mock("../components/tree/ThemeLanguageSettings", () => ({ ThemeLanguageSettings: () => null }));
vi.mock("../components/tree/ContourDecoration", () => ({ ContourDecoration: () => null }));
vi.mock("../components/tree/ReflectionNudge", () => ({
  ReflectionNudge: () => <div data-testid="reflection-nudge" />,
}));

const { default: TreeWorkspacePage } = await import("./TreeWorkspacePage");

const SHARED: Map<string, SharedTreeInfo> = new Map([
  [TREE_ID, { shareId: "share-1", treeId: TREE_ID, ownerLabel: "Anna" }],
]);

type ContextValue = NonNullable<React.ContextType<typeof EncryptionContext>>;

function renderWorkspace(sharedTrees: Map<string, SharedTreeInfo>) {
  const encryption = {
    masterKey: {} as CryptoKey,
    treeKeys: new Map([[TREE_ID, {} as CryptoKey]]),
    keyRingBase64: new Map(),
    sharedTrees,
    isSharedTree: (id: string) => sharedTrees.has(id),
    encrypt: vi.fn(async () => "ciphertext"),
    decrypt: vi.fn(),
  } as unknown as ContextValue;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EncryptionContext.Provider value={encryption}>
        <MemoryRouter initialEntries={["/trees/shared"]}>
          <TreeWorkspacePage />
        </MemoryRouter>
      </EncryptionContext.Provider>
    </QueryClientProvider>,
  );
}

function writeSpies(): [string, ReturnType<typeof vi.fn>][] {
  return Object.entries(api).flatMap(([name, value]) =>
    WRITE_PREFIX.test(name) && vi.isMockFunction(value)
      ? [[name, value as unknown as ReturnType<typeof vi.fn>]]
      : [],
  );
}

function calledWriters(): string[] {
  return writeSpies()
    .filter(([, spy]) => spy.mock.calls.length > 0)
    .map(([name]) => name);
}

beforeEach(() => {
  treeData.error = null;
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe("TreeWorkspacePage for a shared tree", () => {
  it("issues no write requests in read-only mode", async () => {
    const user = userEvent.setup();
    renderWorkspace(SHARED);
    expect(writeSpies().length).toBeGreaterThan(20);

    const flow = screen.getByTestId("react-flow");
    expect(flow.dataset.draggable).toBe("false");
    expect(flow.dataset.connectable).toBe("false");
    expect(flow.dataset.contextMenu).toBe("false");

    fireEvent.click(screen.getByTestId("trigger-node-drag"));
    fireEvent.click(screen.getByTestId("trigger-connect"));
    fireEvent.keyDown(window, { key: "n" });
    fireEvent.keyDown(window, { key: "z", metaKey: true });

    fireEvent.click(screen.getByTestId("trigger-node-click"));
    const page = await screen.findByRole("complementary", { name: "Grandmother" });
    await user.click(within(page).getByText("personPage.details"));
    const nameInput = within(page).getByLabelText("person.name");
    expect(nameInput.closest("fieldset.panel-readonly")).toBeDisabled();
    expect(nameInput).toBeDisabled();
    await user.type(nameInput, " renamed");
    fireEvent.blur(nameInput);
    await user.keyboard("{Escape}");

    // Mutations encrypt before they send: give any stray one time to land.
    await new Promise((r) => setTimeout(r, 50));
    expect(calledWriters()).toEqual([]);
    expect(screen.queryByTestId("relationship-popover")).not.toBeInTheDocument();
  });

  it("hides journal tab and add person for a shared tree", () => {
    renderWorkspace(SHARED);
    expect(screen.getByText("share.viewOnly:Anna")).toBeInTheDocument();
    expect(screen.queryByText("journal.tab")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "journal.tab" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "tree.addPerson" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "tree.autoLayout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "tree.undo" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("reflection-nudge")).not.toBeInTheDocument();
  });

  it("offers no export for a shared tree", () => {
    renderWorkspace(SHARED);
    const settings = screen.getByTestId("settings-view-tab");
    expect(within(settings).queryByText("export.title")).not.toBeInTheDocument();
    expect(within(settings).queryByText("export.downloadBackup")).not.toBeInTheDocument();
    expect(within(settings).queryByText("export.downloadPlaintext")).not.toBeInTheDocument();
  });

  it("hides add and delete controls in the person page", async () => {
    const user = userEvent.setup();
    renderWorkspace(SHARED);
    fireEvent.click(screen.getByTestId("trigger-node-click"));
    const page = await screen.findByRole("complementary", { name: "Grandmother" });
    await user.click(within(page).getByText("personPage.details"));
    expect(within(page).queryByText(/personPage.addTo/)).not.toBeInTheDocument();
    expect(within(page).queryByText("person.delete")).not.toBeInTheDocument();
    expect(within(page).queryByText("personPage.writeJournal")).not.toBeInTheDocument();
    // Reading stays possible: the page can still be closed.
    expect(within(page).getByRole("button", { name: "common.close" })).toBeEnabled();
  });

  it("shows the no-longer-shared message on 404", () => {
    treeData.error = new api.ApiError(404, "Tree not found");
    renderWorkspace(SHARED);
    expect(screen.getByText("share.noLongerShared")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "share.backToTrees" })).toHaveAttribute(
      "href",
      "/trees",
    );
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });
});

describe("TreeWorkspacePage for an own tree", () => {
  it("owner workspace is unchanged", async () => {
    renderWorkspace(new Map());
    const flow = screen.getByTestId("react-flow");
    expect(flow.dataset.draggable).not.toBe("false");
    expect(flow.dataset.connectable).not.toBe("false");
    expect(flow.dataset.contextMenu).toBe("true");
    expect(screen.queryByText(/share.viewOnly/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.addPerson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.autoLayout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "journal.tab" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "journal.tab" })).toBeInTheDocument();
    expect(screen.getByTestId("reflection-nudge")).toBeInTheDocument();

    // And its writes still go out.
    fireEvent.click(screen.getByTestId("trigger-node-drag"));
    await waitFor(() => expect(api.updatePerson).toHaveBeenCalledTimes(1));
  });

  it("offers both exports for an own tree", () => {
    renderWorkspace(new Map());
    const settings = screen.getByTestId("settings-view-tab");
    expect(within(settings).getByText("export.downloadBackup")).toBeInTheDocument();
    expect(within(settings).getByText("export.downloadPlaintext")).toBeInTheDocument();
  });

  it("shows the usual load error on 404 for an own tree", () => {
    treeData.error = new api.ApiError(404, "Tree not found");
    renderWorkspace(new Map());
    expect(screen.getByText("tree.decryptionError")).toBeInTheDocument();
    expect(screen.queryByText("share.noLongerShared")).not.toBeInTheDocument();
  });
});
