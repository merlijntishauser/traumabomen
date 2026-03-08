import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import SiblingGroupNode from "./SiblingGroupNode";
import type { SiblingGroupNodeData } from "./SiblingGroupNode";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      k === "siblingGroup.label" ? `siblings (${opts?.count})` : k,
  }),
}));

vi.mock("@xyflow/react", () => ({
  Handle: ({ position }: { position: string }) => <div data-testid={`handle-${position}`} />,
  Position: { Top: "top", Bottom: "bottom" },
}));

function makeGroup(overrides: Partial<DecryptedSiblingGroup> = {}): DecryptedSiblingGroup {
  return {
    id: "g1",
    person_ids: ["p1"],
    members: [],
    ...overrides,
  };
}

function renderNode(data: SiblingGroupNodeData, selected = false) {
  return render(
    <SiblingGroupNode
      data={data}
      selected={selected}
      id=""
      type=""
      dragging={false}
      positionAbsoluteX={0}
      positionAbsoluteY={0}
      zIndex={0}
      isConnectable
    />,
  );
}

describe("SiblingGroupNode", () => {
  it("shows count label when no named members", () => {
    renderNode({ group: makeGroup({ members: [{ name: "", birth_year: null }] }) });
    expect(screen.getByText("siblings (2)")).toBeInTheDocument();
  });

  it("shows name list when 4 or fewer named members", () => {
    renderNode({
      group: makeGroup({
        person_ids: [],
        members: [
          { name: "Alice", birth_year: 1990 },
          { name: "Bob", birth_year: 1992 },
        ],
      }),
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows count label when more than 4 named members", () => {
    renderNode({
      group: makeGroup({
        person_ids: [],
        members: [
          { name: "A", birth_year: null },
          { name: "B", birth_year: null },
          { name: "C", birth_year: null },
          { name: "D", birth_year: null },
          { name: "E", birth_year: null },
        ],
      }),
    });
    expect(screen.getByText("siblings (5)")).toBeInTheDocument();
  });

  it("applies selected class", () => {
    const { container } = renderNode({ group: makeGroup() }, true);
    expect(container.querySelector(".sibling-group-node--selected")).toBeTruthy();
  });

  it("renders handles", () => {
    renderNode({ group: makeGroup() });
    expect(screen.getByTestId("handle-top")).toBeInTheDocument();
    expect(screen.getByTestId("handle-bottom")).toBeInTheDocument();
  });
});
