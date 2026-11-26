import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildDemoState } from "../lib/buildDemoState";
import type { DemoFixture } from "../lib/createDemoTree";
import { GuestTreeView } from "./GuestTreeView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) =>
      options?.date ? `${key} ${options.date}` : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: {
    nodes: { id: string; type: string }[];
    onNodeClick: (event: unknown, node: unknown) => void;
    onPaneClick: () => void;
    children?: ReactNode;
  }) => (
    <div data-testid="flow">
      {props.nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          data-testid={`node-${node.id}`}
          onClick={(event) => props.onNodeClick(event, node)}
        />
      ))}
      {props.children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ fitView: vi.fn() }),
  useUpdateNodeInternals: () => vi.fn(),
  Background: () => null,
  Controls: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  Handle: () => null,
}));
vi.mock("@xyflow/react/dist/style.css", () => ({}));

const FIXTURE: DemoFixture = {
  treeName: "The Vermeers",
  persons: [
    {
      id: "p1",
      name: "Ada",
      birth_year: 1942,
      death_year: 1998,
      gender: "female",
      is_adopted: false,
      notes: "the matriarch",
    },
    {
      id: "p2",
      name: "Bram",
      birth_year: 1970,
      death_year: null,
      gender: "male",
      is_adopted: false,
      notes: "",
    },
  ],
  relationships: [
    {
      id: "r1",
      source_person_id: "p1",
      target_person_id: "p2",
      type: "biological_parent",
      periods: [],
    },
  ],
  events: [
    {
      id: "e1",
      person_ids: ["p1"],
      title: "Loss",
      description: "a loss in the family",
      category: "loss",
      approximate_date: "1980",
      severity: 4,
      tags: [],
    },
  ],
  lifeEvents: [],
  turningPoints: [],
  classifications: [],
  patterns: [
    {
      id: "pt1",
      name: "Silence at the table",
      description: "",
      color: "#e11d48",
      linked_entities: [{ entity_type: "trauma_event", entity_id: "e1" }],
      person_ids: ["p1"],
    },
  ],
  siblingGroups: [],
} as unknown as DemoFixture;

const state = buildDemoState(FIXTURE);

function renderView() {
  return render(<GuestTreeView state={state} publishedAt="2026-11-20T10:00:00Z" />);
}

describe("GuestTreeView", () => {
  it("shows the tree name and the published date", () => {
    renderView();
    expect(screen.getByText("The Vermeers")).toBeInTheDocument();
    expect(screen.getByText(/guest\.view\.viewOnly.*2026/)).toBeInTheDocument();
  });

  it("opens the person card when a person is clicked on the canvas", () => {
    renderView();
    expect(screen.queryByLabelText("Ada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("node-p1"));
    expect(screen.getByLabelText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Loss")).toBeInTheDocument();
  });

  it("switches between the tree, timeline and patterns tabs", () => {
    renderView();
    expect(screen.getByTestId("flow")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "tree.timeline" }));
    expect(screen.queryByTestId("flow")).not.toBeInTheDocument();
    expect(screen.getByLabelText("timeline.chartLabel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "guest.view.patterns" }));
    expect(screen.getByText("Silence at the table")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "guest.view.tree" }));
    expect(screen.getByTestId("flow")).toBeInTheDocument();
  });

  it("opens the person card from the timeline with no link anywhere", () => {
    const { container } = renderView();
    fireEvent.click(screen.getByRole("tab", { name: "tree.timeline" }));
    expect(container.querySelectorAll("a")).toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Ada" })[0]);
    expect(screen.getByLabelText("Ada", { selector: "aside" })).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("opens the person card from a timeline entry with no link anywhere", () => {
    const { container } = renderView();
    fireEvent.click(screen.getByRole("tab", { name: "tree.timeline" }));

    fireEvent.click(screen.getAllByRole("button", { name: /Loss/ })[0]);
    expect(screen.getByLabelText("Ada", { selector: "aside" })).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("[href]")).toHaveLength(0);
  });

  it("renders nothing that links into the app", () => {
    const { container } = renderView();
    fireEvent.click(screen.getByTestId("node-p1"));
    fireEvent.click(screen.getByRole("tab", { name: "tree.timeline" }));
    expect(container.querySelectorAll("a")).toHaveLength(0);
    fireEvent.click(screen.getByRole("tab", { name: "guest.view.patterns" }));
    fireEvent.click(screen.getByText("Silence at the table"));
    expect(container.querySelectorAll("a")).toHaveLength(0);
    for (const element of container.querySelectorAll("[href]")) {
      expect(element.getAttribute("href")?.startsWith("/trees")).toBe(false);
    }
  });
});
