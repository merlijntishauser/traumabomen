import type * as Sentry from "@sentry/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorFallback, LazyBoundary, OnboardingGuard } from "./App";

vi.mock("@sentry/react", async () => {
  const actual = await vi.importActual<typeof Sentry>("@sentry/react");
  return { ...actual };
});

let mockKey: CryptoKey | null = null;
let mockAccessToken: string | null = null;
let mockOnboardingFlag = false;

vi.mock("./contexts/EncryptionContext", () => ({
  useEncryption: () => ({ masterKey: mockKey }),
}));

vi.mock("./lib/api", () => ({
  getAccessToken: () => mockAccessToken,
  getOnboardingFlag: () => mockOnboardingFlag,
  acknowledgeOnboarding: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("ErrorFallback", () => {
  it("renders error message and reload button", () => {
    render(<ErrorFallback />);

    expect(screen.getByText("error.title")).toBeInTheDocument();
    expect(screen.getByText("error.description")).toBeInTheDocument();
    expect(screen.getByText("error.reload")).toBeInTheDocument();
  });

  it("reload button calls window.location.reload", async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(<ErrorFallback />);
    await user.click(screen.getByText("error.reload"));

    expect(reloadMock).toHaveBeenCalledOnce();
  });
});

describe("OnboardingGuard", () => {
  it("shows children when not authenticated", () => {
    mockAccessToken = null;
    mockKey = null;
    mockOnboardingFlag = false;

    render(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("shows children when already acknowledged", () => {
    mockAccessToken = "token";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = true;

    render(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("shows onboarding gate when authenticated but not acknowledged", () => {
    mockAccessToken = "token";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = false;

    render(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByText("safety.onboarding.continue")).toBeInTheDocument();
  });

  it("re-syncs with localStorage when flag changes after mount", () => {
    mockAccessToken = null;
    mockKey = null;
    mockOnboardingFlag = false;

    const { rerender } = render(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    // Simulate login updating localStorage and auth state
    mockAccessToken = "token";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = true;

    rerender(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    // Should show children, not the onboarding gate
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByText("safety.onboarding.continue")).not.toBeInTheDocument();
  });
});

describe("LazyBoundary", () => {
  it("renders children normally when no error occurs", () => {
    render(
      <LazyBoundary>
        <div data-testid="lazy-child">page content</div>
      </LazyBoundary>,
    );

    expect(screen.getByTestId("lazy-child")).toBeInTheDocument();
  });

  it("renders ErrorFallback when child throws", () => {
    // Suppress React error boundary console errors in test output
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function ThrowingComponent(): React.ReactNode {
      throw new Error("Render crash");
    }

    render(
      <LazyBoundary>
        <ThrowingComponent />
      </LazyBoundary>,
    );

    expect(screen.getByText("error.title")).toBeInTheDocument();
    expect(screen.getByText("error.reload")).toBeInTheDocument();
    expect(screen.queryByTestId("lazy-child")).not.toBeInTheDocument();

    spy.mockRestore();
  });
});
