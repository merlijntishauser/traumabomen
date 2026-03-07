import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

describe("ConfirmDeleteButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows label initially", () => {
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows confirmation strip after first click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Sure?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.cancel" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onConfirm = vi.fn();
    render(<ConfirmDeleteButton onConfirm={onConfirm} label="Delete" confirmLabel="Sure?" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancels confirmation when cancel button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Sure?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(screen.queryByText("Sure?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("auto-cancels after 10 seconds", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ConfirmDeleteButton onConfirm={vi.fn()} label="Delete" confirmLabel="Sure?" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Sure?")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.queryByText("Sure?")).not.toBeInTheDocument();
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
