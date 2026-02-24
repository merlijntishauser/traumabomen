import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

describe("ConfirmDeleteButton", () => {
  it("shows label initially", () => {
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows confirm label after first click", async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);
    await user.click(screen.getByText("Delete"));
    expect(screen.getByText("Sure?")).toBeInTheDocument();
  });

  it("calls onConfirm on second click", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDeleteButton onConfirm={onConfirm} label="Delete" confirmLabel="Sure?" />);

    await user.click(screen.getByText("Delete"));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByText("Sure?"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("uses default className when not provided", () => {
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);
    expect(screen.getByRole("button")).toHaveClass("detail-panel__btn--danger");
  });

  it("uses custom className when provided", () => {
    render(
      <ConfirmDeleteButton
        onConfirm={vi.fn()}
        label="Delete"
        confirmLabel="Sure?"
        className="custom-class"
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });
});
