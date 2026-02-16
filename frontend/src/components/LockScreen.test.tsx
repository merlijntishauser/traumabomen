import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LockScreen } from "./LockScreen";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("LockScreen", () => {
  it("renders lock screen with title and input", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    expect(screen.getByText("safety.lock.title")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

    // Password input is present
    const input = document.querySelector("input[type='password']");
    expect(input).toBeTruthy();
  });

  it("calls onUnlock with passphrase on submit", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    const input = document.querySelector("input[type='password']") as HTMLInputElement;
    await user.type(input, "my-secret-passphrase");
    await user.click(screen.getByRole("button", { name: "safety.lock.unlock" }));

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith("my-secret-passphrase");
  });

  it("shows error message when wrongAttempts > 0", () => {
    const onUnlock = vi.fn();
    const { rerender } = render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    // No error initially
    expect(screen.queryByText("safety.lock.wrongPassphrase")).not.toBeInTheDocument();

    // Re-render with wrong attempts
    rerender(<LockScreen wrongAttempts={1} onUnlock={onUnlock} />);

    expect(screen.getByText("safety.lock.wrongPassphrase")).toBeInTheDocument();
  });
});
