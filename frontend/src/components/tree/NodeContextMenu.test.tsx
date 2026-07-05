import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NodeContextMenu } from "./NodeContextMenu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function renderMenu(overrides?: Partial<Parameters<typeof NodeContextMenu>[0]>) {
  const props = {
    personId: "p1",
    x: 100,
    y: 100,
    onOpenSection: vi.fn(),
    onOpenDetails: vi.fn(),
    onAddRelated: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<NodeContextMenu {...props} />);
  return props;
}

describe("NodeContextMenu", () => {
  it("renders the three groups with two dividers", () => {
    const { container } = render(
      <NodeContextMenu
        personId="p1"
        x={0}
        y={0}
        onOpenSection={vi.fn()}
        onOpenDetails={vi.fn()}
        onAddRelated={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelectorAll(".node-menu__divider")).toHaveLength(2);
    expect(screen.getByText("nodeMenu.addTrauma")).toBeInTheDocument();
    expect(screen.getByText("nodeMenu.addSibling")).toBeInTheDocument();
    expect(screen.getByText("nodeMenu.openDetails")).toBeInTheDocument();
  });

  it.each([
    ["nodeMenu.addTrauma", "trauma_event"],
    ["nodeMenu.addLifeEvent", "life_event"],
    ["nodeMenu.addTurningPoint", "turning_point"],
    ["nodeMenu.addClassification", "classification"],
  ] as const)("attach action %s opens section %s and closes", async (label, section) => {
    const user = userEvent.setup();
    const props = renderMenu();
    await user.click(screen.getByText(label));
    expect(props.onOpenSection).toHaveBeenCalledWith("p1", section);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ["nodeMenu.addSibling", "sibling"],
    ["nodeMenu.addPartner", "partner"],
    ["nodeMenu.addParent", "parent"],
    ["nodeMenu.addChild", "child"],
  ] as const)("relation action %s adds %s and closes", async (label, kind) => {
    const user = userEvent.setup();
    const props = renderMenu();
    await user.click(screen.getByText(label));
    expect(props.onAddRelated).toHaveBeenCalledWith("p1", kind);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("open details selects the person", async () => {
    const user = userEvent.setup();
    const props = renderMenu();
    await user.click(screen.getByText("nodeMenu.openDetails"));
    expect(props.onOpenDetails).toHaveBeenCalledWith("p1");
  });

  it("delete requires a second click; cancel aborts", async () => {
    const user = userEvent.setup();
    const props = renderMenu();

    await user.click(screen.getByText("nodeMenu.deletePerson"));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("nodeMenu.confirmDelete")).toBeInTheDocument();

    await user.click(screen.getByText("common.cancel"));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("nodeMenu.deletePerson")).toBeInTheDocument();

    await user.click(screen.getByText("nodeMenu.deletePerson"));
    await user.click(screen.getByText("nodeMenu.confirmDelete"));
    expect(props.onDelete).toHaveBeenCalledWith("p1");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closes on Escape and on outside click", () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("flips left/up when opened near the viewport edge", () => {
    const { container } = render(
      <NodeContextMenu
        personId="p1"
        x={window.innerWidth - 5}
        y={window.innerHeight - 5}
        onOpenSection={vi.fn()}
        onOpenDetails={vi.fn()}
        onAddRelated={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const menu = container.querySelector(".node-menu") as HTMLElement;
    // Anchored well left/up of the cursor rather than overflowing.
    expect(Number.parseFloat(menu.style.left)).toBeLessThan(window.innerWidth - 5);
    expect(Number.parseFloat(menu.style.top)).toBeLessThan(window.innerHeight - 5);
  });
});
