import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { EncryptionContext, type SharingStatus } from "../../contexts/EncryptionContext";
import { useTreeAccess } from "../../hooks/useTreeAccess";
import type { SharedTreeInfo } from "../../lib/sharingLoader";
import { TreeAccessGate } from "./TreeAccessGate";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));

const TREE_ID = vi.hoisted(() => "03f28958-029f-4663-82e3-4de766986d28");
vi.mock("../../hooks/useTreeId", () => ({ useTreeId: () => TREE_ID }));

type ContextValue = NonNullable<React.ContextType<typeof EncryptionContext>>;

/** Stands in for a tree view: shows what access it was given. */
function View() {
  const { readOnly } = useTreeAccess(TREE_ID);
  return (
    <div data-testid="view">
      {readOnly ? "read-only" : "editable"}
      {!readOnly && <button type="button">tree.addPerson</button>}
    </div>
  );
}

function context(
  sharingStatus: SharingStatus,
  { own = false, shared = false }: { own?: boolean; shared?: boolean } = {},
): ContextValue {
  const treeKeys = new Map<string, CryptoKey>();
  const sharedTrees = new Map<string, SharedTreeInfo>();
  if (own || shared) treeKeys.set(TREE_ID, {} as CryptoKey);
  if (shared) sharedTrees.set(TREE_ID, { shareId: "s1", treeId: TREE_ID, ownerLabel: "Anna" });
  return { treeKeys, sharedTrees, sharingStatus } as unknown as ContextValue;
}

function ui(value: ContextValue) {
  return (
    <EncryptionContext.Provider value={value}>
      <MemoryRouter>
        <TreeAccessGate>
          <View />
        </TreeAccessGate>
      </MemoryRouter>
    </EncryptionContext.Provider>
  );
}

describe("TreeAccessGate", () => {
  it("shows only loading on a deep link before sharing has loaded", () => {
    render(ui(context("loading")));
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("view")).not.toBeInTheDocument();
    expect(screen.queryByText("tree.addPerson")).not.toBeInTheDocument();
  });

  it("also waits while sharing has not started", () => {
    render(ui(context("idle")));
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("view")).not.toBeInTheDocument();
  });

  it("opens the tree read-only once sharing loads with it", () => {
    const { rerender } = render(ui(context("loading")));
    rerender(ui(context("loaded", { shared: true })));
    expect(screen.getByTestId("view")).toHaveTextContent("read-only");
    expect(screen.queryByText("tree.addPerson")).not.toBeInTheDocument();
    expect(screen.queryByText("common.loading")).not.toBeInTheDocument();
  });

  it("says the tree is unavailable once sharing loads without it", () => {
    const { rerender } = render(ui(context("loading")));
    rerender(ui(context("loaded")));
    expect(screen.getByText("tree.unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "share.backToTrees" })).toHaveAttribute(
      "href",
      "/trees",
    );
    expect(screen.queryByTestId("view")).not.toBeInTheDocument();
    expect(screen.queryByText("tree.addPerson")).not.toBeInTheDocument();
  });

  it("opens an own tree right away, without waiting for sharing", () => {
    render(ui(context("loading", { own: true })));
    expect(screen.getByTestId("view")).toHaveTextContent("editable");
  });
});
