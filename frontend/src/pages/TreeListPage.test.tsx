import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TreeListPage from "./TreeListPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();
const mockMutate = vi.fn();

vi.mock("../components/FeedbackModal", () => ({
  FeedbackModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="feedback-modal">
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock("../components/tree/SettingsPanel", () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
}));

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    masterKey: {} as CryptoKey,
    treeKeys: new Map(),
    keyRingBase64: new Map(),
    addTreeKey: vi.fn(),
    removeTreeKey: vi.fn(),
  }),
}));

vi.mock("../hooks/useLogout", () => ({
  useLogout: () => vi.fn(),
}));

vi.mock("../lib/api", () => ({
  createTree: vi.fn(),
  deleteTree: vi.fn(),
  getIsAdmin: () => false,
  getTrees: vi.fn(),
  updateKeyRing: vi.fn(),
  updateTree: vi.fn(),
}));

vi.mock("../lib/compactId", () => ({
  uuidToCompact: (id: string) => id.slice(0, 8),
}));

vi.mock("../lib/createDemoTree", () => ({
  createDemoTree: vi.fn().mockResolvedValue("demo-tree-id"),
}));

// Control useQuery return value per test
let mockQueryReturn: {
  data:
    | {
        id: string;
        name: string;
        is_demo: boolean;
        person_count?: number;
        moment_count?: number;
        pattern_count?: number;
        updated_at?: string;
      }[]
    | undefined;
  isLoading: boolean;
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mockQueryReturn,
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

const localStorageStore: Record<string, string> = {};
const mockGetItem = vi.fn((key: string) => localStorageStore[key] ?? null); // privacy-ok: test mock
const mockSetItem = vi.fn((key: string, value: string) => {
  localStorageStore[key] = value; // privacy-ok: test mock
});

vi.stubGlobal("localStorage", {
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

describe("TreeListPage first-tree empty state", () => {
  beforeEach(() => {
    mockQueryReturn = { data: undefined, isLoading: true };
  });

  function renderPage() {
    return render(<TreeListPage />);
  }

  it("shows the first-tree welcome when there are no trees", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    expect(screen.getByTestId("first-tree-welcome")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "firstTree.title" })).toBeInTheDocument();
    expect(screen.getByText("firstTree.body")).toBeInTheDocument();
  });

  it("offers one primary create action and a quiet demo option", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    expect(screen.getByRole("button", { name: "welcome.createTree" })).toHaveClass("btn--primary");
    expect(screen.getByRole("button", { name: "firstTree.exploreDemo" })).toBeInTheDocument();
  });

  it("hides the toolbar create and demo buttons while the list is empty", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    expect(screen.queryByRole("button", { name: "tree.create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "demo.createButton" })).not.toBeInTheDocument();
  });

  it("shows the create form inside the welcome after choosing to create", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "welcome.createTree" }));
    const welcome = screen.getByTestId("first-tree-welcome");
    expect(welcome.querySelector("form.tree-list-create")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "welcome.createTree" })).not.toBeInTheDocument();
  });

  it("opens the feedback modal from the beta note", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();

    expect(screen.queryByTestId("feedback-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("welcome.sendMessage"));
    expect(screen.getByTestId("feedback-modal")).toBeInTheDocument();
  });

  it("does not show the welcome while trees are loading", () => {
    renderPage();
    expect(screen.queryByTestId("first-tree-welcome")).not.toBeInTheDocument();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("retires the welcome and shows toolbar actions once a tree exists", () => {
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree", is_demo: false }],
      isLoading: false,
    };
    renderPage();
    expect(screen.queryByTestId("first-tree-welcome")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tree.create" })).toBeInTheDocument();
  });
});

describe("TreeListPage continue card", () => {
  function tree(id: string, updated_at: string, person_count = 1) {
    return {
      id,
      name: `Tree ${id}`,
      is_demo: false,
      person_count,
      moment_count: 0,
      pattern_count: 0,
      updated_at,
    };
  }

  it("is hidden with a single tree, which the list already shows", () => {
    mockQueryReturn = { data: [tree("a", "2026-01-01T00:00:00Z")], isLoading: false };
    render(<TreeListPage />);
    expect(screen.queryByText("tree.continue")).not.toBeInTheDocument();
  });

  it("features the most recently tended tree when there are several", () => {
    mockQueryReturn = {
      data: [tree("a", "2026-01-01T00:00:00Z"), tree("b", "2026-03-01T00:00:00Z")],
      isLoading: false,
    };
    const { container } = render(<TreeListPage />);
    expect(container.querySelector(".tree-continue__name")?.textContent).toBe("Tree b");
  });

  it("points an unstarted tree at the canvas instead of a journal prompt", () => {
    mockQueryReturn = {
      data: [tree("a", "2026-01-01T00:00:00Z"), tree("b", "2026-03-01T00:00:00Z", 0)],
      isLoading: false,
    };
    render(<TreeListPage />);
    const link = screen.getByText("tree.startWithYourself");
    expect(link.getAttribute("href")).not.toContain("/journal");
  });

  it("lists trees most recently tended first", () => {
    mockQueryReturn = {
      data: [
        tree("a", "2026-01-01T00:00:00Z"),
        tree("b", "2026-03-01T00:00:00Z"),
        tree("c", "2026-02-01T00:00:00Z"),
      ],
      isLoading: false,
    };
    const { container } = render(<TreeListPage />);
    const names = [...container.querySelectorAll(".tree-list-item__name")].map((n) =>
      n.textContent?.trim(),
    );
    expect(names).toEqual(["Tree b", "Tree c", "Tree a"]);
  });
});

describe("TreeListPage demo tree", () => {
  beforeEach(() => {
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  function renderPage() {
    return render(<TreeListPage />);
  }

  it("offers the demo tree from the toolbar once trees exist", () => {
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree", is_demo: false }],
      isLoading: false,
    };
    renderPage();
    expect(screen.getByRole("button", { name: "demo.createButton" })).toBeInTheDocument();
  });

  it("shows demo badge on demo trees", () => {
    mockQueryReturn = {
      data: [
        { id: "tree-1", name: "My Tree", is_demo: false },
        { id: "tree-2", name: "Demo Tree", is_demo: true },
      ],
      isLoading: false,
    };
    renderPage();
    expect(screen.getByText("demo.badge")).toBeInTheDocument();
  });

  it("creates the demo tree once when arriving with ?start=demo", () => {
    mockQueryReturn = { data: [], isLoading: false };
    mockSearchParams = new URLSearchParams("start=demo");
    mockMutate.mockClear();
    mockSetSearchParams.mockClear();

    const { rerender } = renderPage();
    rerender(<TreeListPage />);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
    mockSearchParams = new URLSearchParams();
  });

  it("does not create a demo tree without the start param", () => {
    mockQueryReturn = { data: [], isLoading: false };
    mockMutate.mockClear();
    renderPage();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("does not show demo badge on non-demo trees", () => {
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree", is_demo: false }],
      isLoading: false,
    };
    renderPage();
    expect(screen.queryByText("demo.badge")).not.toBeInTheDocument();
  });
});

describe("TreeListPage accessibility", () => {
  const oneTree = {
    data: [{ id: "tree-1", name: "Mother's side", is_demo: false }],
    isLoading: false,
  };

  it("uses the page title as its h1", () => {
    mockQueryReturn = oneTree;
    render(<TreeListPage />);
    expect(screen.getByRole("heading", { level: 1, name: "tree.myTrees" })).toBeInTheDocument();
  });

  it("offers a skip link to the tree list", () => {
    mockQueryReturn = oneTree;
    const { container } = render(<TreeListPage />);
    const skip = screen.getByText("tree.skipToTrees");
    expect(skip).toHaveAttribute("href", "#tree-list-content");
    expect(container.querySelector("#tree-list-content")).not.toBeNull();
  });

  it("keeps rename and delete behind a named options menu", () => {
    mockQueryReturn = oneTree;
    render(<TreeListPage />);
    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor" }));
    expect(screen.getByRole("menuitem", { name: "tree.rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "tree.deleteTree" })).toBeInTheDocument();
  });

  it("names the tree and starts on cancel when confirming delete", () => {
    mockQueryReturn = oneTree;
    render(<TreeListPage />);
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
    expect(screen.getByText("tree.confirmDeleteNamed")).toBeInTheDocument();
    expect(screen.getByText("tree.confirmDeleteBody")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "common.cancel" }));
  });

  it("keeps only one row action open at a time", () => {
    mockQueryReturn = {
      data: [
        { id: "tree-1", name: "Mother's side", is_demo: false },
        { id: "tree-2", name: "Father's side", is_demo: false },
      ],
      isLoading: false,
    };
    render(<TreeListPage />);
    const [first, second] = screen.getAllByRole("button", { name: "tree.optionsFor" });
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.rename" }));
    expect(screen.getByRole("textbox", { name: "tree.namePlaceholder" })).toBeInTheDocument();

    fireEvent.click(second);
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
    expect(screen.getByText("tree.confirmDeleteNamed")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "tree.namePlaceholder" })).not.toBeInTheDocument();
  });

  it("focuses the name field when creating and returns focus on cancel", () => {
    mockQueryReturn = oneTree;
    render(<TreeListPage />);
    fireEvent.click(screen.getByRole("button", { name: "tree.create" }));
    const field = screen.getByRole("textbox", { name: "tree.nameLabel" });
    expect(document.activeElement).toBe(field);
    expect(field).toHaveAttribute("placeholder", "tree.nameExample");
    expect(field).toHaveAccessibleDescription("tree.nameHint");

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "tree.create" }));
  });

  it("focuses the rename field when editing a tree", () => {
    mockQueryReturn = oneTree;
    render(<TreeListPage />);
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.rename" }));
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "tree.namePlaceholder" }),
    );
  });
});

describe("TreeListPage unreadable trees", () => {
  it("labels a tree that could not be decrypted and offers no rename", () => {
    mockQueryReturn = {
      data: [
        {
          id: "tree-1",
          name: "tree.unreadableName",
          is_demo: false,
          unreadable: true,
        } as never,
      ],
      isLoading: false,
    };
    render(<TreeListPage />);
    expect(screen.getByText("tree.unreadableHint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor" }));
    expect(screen.queryByRole("menuitem", { name: "tree.rename" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "tree.deleteTree" })).toBeInTheDocument();
  });
});
