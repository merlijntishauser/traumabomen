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
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

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
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

    const input = document.querySelector("input[type='password']") as HTMLInputElement;
    await user.type(input, "my-secret-passphrase");
    await user.click(screen.getByRole("button", { name: "safety.lock.unlock" }));

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith("my-secret-passphrase");
  });

  it("shows error message when wrongAttempts > 0", () => {
    const onUnlock = vi.fn();
    const { rerender } = render(
      <LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />,
    );

    // No error initially
    expect(screen.queryByText("safety.lock.wrongPassphrase")).not.toBeInTheDocument();

    // Re-render with wrong attempts
    rerender(<LockScreen wrongAttempts={1} onUnlock={onUnlock} onLogout={vi.fn()} />);

    expect(screen.getByText("safety.lock.wrongPassphrase")).toBeInTheDocument();
  });

  it("does not call onUnlock when submitting empty passphrase", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

    // Submit button should be disabled with empty input
    const submitBtn = screen.getByRole("button", { name: "safety.lock.unlock" });
    expect(submitBtn).toBeDisabled();

    await user.click(submitBtn);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("handleSubmit guards against empty passphrase via form submit", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

    const form = document.querySelector(".lock-screen__form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("blocks non-Escape keyboard events outside the input", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

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
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const notPrevented = document.dispatchEvent(event);
    // Escape should NOT be prevented (for double-Esc detection)
    expect(notPrevented).toBe(true);
  });

  it("renders three theme-aware background images", () => {
    const onUnlock = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />);

    const images = document.querySelectorAll(".lock-screen__bg");
    expect(images).toHaveLength(3);
    expect(images[0].getAttribute("src")).toBe("/images/hero-unlock-dark.jpg");
    expect(images[1].getAttribute("src")).toBe("/images/hero-unlock-light.jpg");
    expect(images[2].getAttribute("src")).toBe("/images/hero-unlock-watercolor.jpg");
    for (const img of images) {
      expect(img.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("wraps each image in a picture element with webp source", () => {
    render(<LockScreen wrongAttempts={0} onUnlock={vi.fn()} onLogout={vi.fn()} />);

    const card = document.querySelector(".lock-screen__card")!;
    const pictures = card.querySelectorAll("picture");
    expect(pictures).toHaveLength(3);
    const sources = card.querySelectorAll("source[type='image/webp']");
    expect(sources).toHaveLength(3);
    expect(sources[0].getAttribute("srcset")).toBe("/images/hero-unlock-dark.webp");
    expect(sources[1].getAttribute("srcset")).toBe("/images/hero-unlock-light.webp");
    expect(sources[2].getAttribute("srcset")).toBe("/images/hero-unlock-watercolor.webp");
  });

  it("sets loading=lazy only on watercolor image", () => {
    render(<LockScreen wrongAttempts={0} onUnlock={vi.fn()} onLogout={vi.fn()} />);

    const images = document.querySelectorAll(".lock-screen__bg");
    expect(images[0].getAttribute("loading")).toBeNull();
    expect(images[1].getAttribute("loading")).toBeNull();
    expect(images[2].getAttribute("loading")).toBe("lazy");
  });

  it("calls onLogout when logout button is clicked", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    const onLogout = vi.fn();
    render(<LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={onLogout} />);

    await user.click(screen.getByText("auth.switchAccount"));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("applies shake class when wrongAttempts increases", () => {
    const onUnlock = vi.fn();
    const { rerender } = render(
      <LockScreen wrongAttempts={0} onUnlock={onUnlock} onLogout={vi.fn()} />,
    );

    const input = document.querySelector("input[type='password']") as HTMLInputElement;
    expect(input.className).not.toContain("shake");

    rerender(<LockScreen wrongAttempts={1} onUnlock={onUnlock} onLogout={vi.fn()} />);
    expect(input.className).toContain("shake");
  });
});
