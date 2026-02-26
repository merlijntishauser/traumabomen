import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VerificationPendingPage from "./VerificationPendingPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.seconds !== undefined) return `${key} (${opts.seconds})`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

const mockResendVerification = vi.fn();
vi.mock("../lib/api", () => ({
  resendVerification: (...args: unknown[]) => mockResendVerification(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

let mockLocationState: { email?: string } | null = { email: "test@example.com" };
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ state: mockLocationState }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../components/AuthHero", () => ({
  AuthHero: () => <div data-testid="auth-hero" />,
}));

describe("VerificationPendingPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLocationState = { email: "test@example.com" };
    mockResendVerification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the verification pending page", () => {
    render(<VerificationPendingPage />);

    expect(screen.getByText("auth.checkEmail")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("clears interval on unmount during active cooldown", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = render(<VerificationPendingPage />);

    // Click resend and flush the resolved promise
    await act(async () => {
      screen.getByText("auth.resendVerification").click();
    });

    // Verify cooldown started
    expect(screen.getByText("auth.resendCooldown (60)")).toBeInTheDocument();

    // Advance a few seconds to confirm interval is running
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("auth.resendCooldown (58)")).toBeInTheDocument();

    // Unmount while cooldown is still active
    clearIntervalSpy.mockClear();
    unmount();

    // clearInterval should have been called during cleanup
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("does not leak interval when cooldown finishes naturally", async () => {
    render(<VerificationPendingPage />);

    await act(async () => {
      screen.getByText("auth.resendVerification").click();
    });

    // Fast-forward through the full cooldown
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Button should be re-enabled
    const btn = screen.getByText("auth.resendVerification");
    expect(btn).not.toBeDisabled();
  });
});
