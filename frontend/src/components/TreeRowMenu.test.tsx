import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreeRowMenu } from "./TreeRowMenu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts?.name ? `${k}:${opts.name}` : k),
  }),
}));

function setup() {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  render(<TreeRowMenu treeName="Mother's side" onRename={onRename} onDelete={onDelete} />);
  const trigger = screen.getByRole("button", { name: "tree.optionsFor:Mother's side" });
  return { onRename, onDelete, trigger };
}

describe("TreeRowMenu", () => {
  it("names the tree in the trigger and starts closed", () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens with focus on the first item", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "tree.rename" }));
  });

  it("moves between items with the arrow keys, wrapping around", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "tree.rename" }));
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
  });

  it("runs the chosen action and closes", () => {
    const { trigger, onRename, onDelete } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on a click outside", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("TreeRowMenu without rename", () => {
  it("offers only delete and focuses it on open", () => {
    render(<TreeRowMenu treeName="Unreadable tree" onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "tree.optionsFor:Unreadable tree" }));
    expect(screen.queryByRole("menuitem", { name: "tree.rename" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "tree.deleteTree" }));
  });
});
