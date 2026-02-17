import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not call onUnlock when submitting empty passphrase", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    // Submit button should be disabled with empty input
    const submitBtn = screen.getByRole("button", { name: "safety.lock.unlock" });
    expect(submitBtn).toBeDisabled();

    await user.click(submitBtn);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("handleSubmit guards against empty passphrase via form submit", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    const form = document.querySelector(".lock-screen__form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("blocks non-Escape keyboard events outside the input", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    // Dispatch a keydown on document (not on the input)
    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    const prevented = !document.dispatchEvent(event);
    // The event should have been stopped (preventDefault called in capturing phase)
    expect(prevented).toBe(true);
  });

  it("allows Escape key to propagate through", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const notPrevented = document.dispatchEvent(event);
    // Escape should NOT be prevented (for double-Esc detection)
    expect(notPrevented).toBe(true);
  });

  it("renders theme-aware background images", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    const darkImg = document.querySelector(".lock-screen__bg--dark") as HTMLImageElement;
    const lightImg = document.querySelector(".lock-screen__bg--light") as HTMLImageElement;
    expect(darkImg).toBeTruthy();
    expect(lightImg).toBeTruthy();
    expect(darkImg.getAttribute("src")).toBe("/images/hero-unlock-dark.jpg");
    expect(lightImg.getAttribute("src")).toBe("/images/hero-unlock-light.jpg");
    expect(darkImg.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies shake class when wrongAttempts increases", () => {
    const onUnlock = vi.fn();
    const { rerender } = render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} />);

    const input = document.querySelector("input[type='password']") as HTMLInputElement;
    expect(input.className).not.toContain("shake");

    rerender(<LockScreen wrongAttempts={1} onUnlock={onUnlock} />);
    expect(input.className).toContain("shake");
  });
});
