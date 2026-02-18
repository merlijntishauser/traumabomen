import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TreeListPage from "./TreeListPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("react-router-dom", () => ({
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
}));

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

vi.mock("../contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  }),
}));

vi.mock("../hooks/useCanvasSettings", () => ({
  useCanvasSettings: () => ({
    settings: {},
    update: vi.fn(),
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
  updateTree: vi.fn(),
}));

vi.mock("../lib/compactId", () => ({
  uuidToCompact: (id: string) => id.slice(0, 8),
}));

// Control useQuery return value per test
let mockQueryReturn: {
  data: { id: string; name: string }[] | undefined;
  isLoading: boolean;
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mockQueryReturn,
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

const STORAGE_KEY = "traumabomen_welcome_dismissed";

const localStorageStore: Record<string, string> = {};
const mockGetItem = vi.fn((key: string) => localStorageStore[key] ?? null);
const mockSetItem = vi.fn((key: string, value: string) => {
  localStorageStore[key] = value;
});

vi.stubGlobal("localStorage", {
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

describe("TreeListPage welcome card", () => {
  beforeEach(() => {
    mockQueryReturn = { data: undefined, isLoading: true };
    delete localStorageStore[STORAGE_KEY];
    mockGetItem.mockClear();
    mockSetItem.mockClear();
  });

  afterEach(() => {
    delete localStorageStore[STORAGE_KEY];
  });

  function renderPage() {
    return render(<TreeListPage />);
  }

  it("shows welcome card when no trees and not dismissed", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    expect(screen.getByTestId("welcome-card")).toBeInTheDocument();
    expect(screen.getByText("welcome.title")).toBeInTheDocument();
    expect(screen.getByText("welcome.body")).toBeInTheDocument();
  });

  it("shows welcome card when trees exist but not dismissed", () => {
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree" }],
      isLoading: false,
    };
    renderPage();
    expect(screen.getByTestId("welcome-card")).toBeInTheDocument();
  });

  it("hides welcome card when trees exist and dismissed", () => {
    localStorageStore[STORAGE_KEY] = "true";
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree" }],
      isLoading: false,
    };
    renderPage();
    expect(screen.queryByTestId("welcome-card")).not.toBeInTheDocument();
  });

  it("shows welcome card when dismissed but no trees (starting over)", () => {
    localStorageStore[STORAGE_KEY] = "true";
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    expect(screen.getByTestId("welcome-card")).toBeInTheDocument();
  });

  it("dismiss button sets localStorage and hides card when trees exist", () => {
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree" }],
      isLoading: false,
    };
    renderPage();
    expect(screen.getByTestId("welcome-card")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("common.close"));
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, "true");
    expect(screen.queryByTestId("welcome-card")).not.toBeInTheDocument();
  });

  it("shows 'create tree' button when no trees exist", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();
    expect(screen.getByText("welcome.createTree")).toBeInTheDocument();
  });

  it("hides 'create tree' button when trees exist", () => {
    mockQueryReturn = {
      data: [{ id: "tree-1", name: "My Tree" }],
      isLoading: false,
    };
    renderPage();
    expect(screen.queryByText("welcome.createTree")).not.toBeInTheDocument();
  });

  it("shows 'send message' button that opens feedback modal", () => {
    mockQueryReturn = { data: [], isLoading: false };
    renderPage();

    expect(screen.queryByTestId("feedback-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("welcome.sendMessage"));
    expect(screen.getByTestId("feedback-modal")).toBeInTheDocument();
  });

  it("shows welcome card while data is loading", () => {
    mockQueryReturn = { data: undefined, isLoading: true };
    renderPage();
    expect(screen.getByTestId("welcome-card")).toBeInTheDocument();
  });
});
