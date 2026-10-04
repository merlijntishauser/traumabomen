import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecryptedPerson, DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import { LatestTreeBand } from "./LatestTreeBand";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) => (opts?.name ? `${key}:${opts.name}` : key),
    i18n: { language: "en" },
  }),
}));

vi.mock("react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../lib/compactId", () => ({ uuidToCompact: (id: string) => id }));

function person(id: string, name: string): DecryptedPerson {
  return {
    id,
    name,
    birth_year: null,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "",
    is_adopted: false,
    notes: null,
  };
}

let mockData: {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  isLoading: boolean;
};
let mockNodes: { id: string; position: { x: number; y: number } }[];

vi.mock("../hooks/useTreeData", () => ({
  useTreeData: () => ({
    ...mockData,
    events: new Map(),
    lifeEvents: new Map(),
    turningPoints: new Map(),
    classifications: new Map(),
    siblingGroups: new Map(),
  }),
}));

vi.mock("../hooks/useTreeLayout", () => ({
  useTreeLayout: () => ({ nodes: mockNodes, edges: [] }),
}));

const baseTree = { id: "t1", name: "Mother's side", is_demo: false, person_count: 2 };

function renderBand(overrides: Partial<Parameters<typeof LatestTreeBand>[0]> = {}) {
  const props = {
    tree: baseTree,
    metaLine: "2 people · updated today",
    prompt: "What was never spoken about?",
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<LatestTreeBand {...props} />) };
}

beforeEach(() => {
  mockData = {
    persons: new Map([
      ["a", person("a", "Margriet")],
      ["b", person("b", "Hendrik Willem Johannes Vos")],
    ]),
    relationships: new Map([
      [
        "r",
        {
          id: "r",
          type: RelationshipType.Partner,
          source_person_id: "a",
          target_person_id: "b",
          periods: [],
          active_period: null,
        },
      ],
    ]),
    isLoading: false,
  };
  mockNodes = [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 260, y: 0 } },
    { id: "sibling-group-1", position: { x: 600, y: 0 } },
  ];
});

describe("LatestTreeBand", () => {
  it("names the tree and its last tending", () => {
    renderBand();
    expect(screen.getByRole("heading", { level: 2, name: "Mother's side" })).toBeInTheDocument();
    expect(screen.getByText("2 people · updated today")).toBeInTheDocument();
  });

  it("draws the people and lines of the tree, skipping non-person nodes", () => {
    const { container } = renderBand();
    const names = [...container.querySelectorAll(".tree-band__node-name")].map(
      (n) => n.textContent,
    );
    expect(names).toEqual(["Margriet", "Hendrik Willem Joha…"]);
    expect(container.querySelectorAll(".tree-band__link--partner")).toHaveLength(1);
  });

  it("opens the tree from the preview and the primary action", () => {
    renderBand();
    expect(screen.getByLabelText("treeList.openNamed:Mother's side")).toHaveAttribute(
      "href",
      "/trees/t1",
    );
    expect(screen.getByRole("link", { name: "treeList.openTree" })).toHaveAttribute(
      "href",
      "/trees/t1",
    );
  });

  it("asks an open question that leads to the journal", () => {
    renderBand();
    expect(screen.getByText("What was never spoken about?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "treeList.writeAboutIt" })).toHaveAttribute(
      "href",
      "/trees/t1/journal",
    );
  });

  it("shows plain loading text while the tree decrypts", () => {
    mockData.isLoading = true;
    renderBand();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("offers a first place for someone in an empty tree", () => {
    renderBand({ tree: { ...baseTree, person_count: 0 } });
    expect(screen.getByText("tree.startWithYourself")).toBeInTheDocument();
    expect(screen.getByText("treeList.firstPersonHint")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "treeList.writeAboutIt" })).not.toBeInTheDocument();
  });

  it("marks a demo tree", () => {
    renderBand({ tree: { ...baseTree, is_demo: true } });
    expect(screen.getByText("demo.badge")).toBeInTheDocument();
  });

  it("offers rename and delete from its options menu", () => {
    const { props } = renderBand();
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor:Mother's side" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.rename" }));
    expect(props.onRename).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor:Mother's side" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
    expect(props.onDelete).toHaveBeenCalledOnce();
  });

  it("puts the editor in place of the name while renaming", () => {
    renderBand({ children: <form aria-label="rename form" /> });
    expect(screen.getByRole("form", { name: "rename form" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });
});
