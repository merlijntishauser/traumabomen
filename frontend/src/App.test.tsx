import type * as Sentry from "@sentry/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthGuard, ErrorFallback, LazyBoundary, OnboardingGuard } from "./App";

vi.mock("@sentry/react", async () => {
  const actual = await vi.importActual<typeof Sentry>("@sentry/react");
  return { ...actual };
});

let mockKey: CryptoKey | null = null;
let mockAccessToken: string | null = null;
let mockOnboardingFlag = false;
let mockWasAuthenticated = false;

vi.mock("./contexts/useEncryption", () => ({
  useEncryption: () => ({ masterKey: mockKey }),
}));

vi.mock("./lib/api", () => ({
  getAccessToken: () => mockAccessToken,
  getOnboardingFlag: () => mockOnboardingFlag,
  getWasAuthenticated: () => mockWasAuthenticated,
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

  it("does not trigger render-phase setState warnings in StrictMode", () => {
    mockAccessToken = "token";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = true;

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <StrictMode>
        <OnboardingGuard>
          <div data-testid="child">content</div>
        </OnboardingGuard>
      </StrictMode>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    const stateWarnings = spy.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("Cannot update"),
    );
    expect(stateWarnings).toHaveLength(0);

    spy.mockRestore();
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

  it("re-arms the gate when a new account registers in the same tab", () => {
    // First account already acknowledged the gate.
    mockAccessToken = "token-a";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = true;

    const { rerender } = render(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();

    // Logout, then register() sets the flag back to false and a new key unlocks.
    mockAccessToken = "token-b";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = false;

    rerender(
      <OnboardingGuard>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
    expect(screen.getByText("safety.onboarding.continue")).toBeInTheDocument();
  });

  it("passes demo and logout actions through to the gate", () => {
    mockAccessToken = "token";
    mockKey = {} as CryptoKey;
    mockOnboardingFlag = false;

    render(
      <OnboardingGuard onStartDemo={vi.fn()} onLogout={vi.fn()}>
        <div data-testid="child">content</div>
      </OnboardingGuard>,
    );

    expect(
      screen.getByRole("button", { name: "safety.onboarding.startWithDemo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "safety.onboarding.notNow" })).toBeInTheDocument();
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

describe("AuthGuard", () => {
  function renderGuarded() {
    return render(
      <MemoryRouter initialEntries={["/trees/t1"]}>
        <Routes>
          <Route
            path="/trees/:id"
            element={
              <AuthGuard>
                <div data-testid="tree">Anna Smith</div>
              </AuthGuard>
            }
          />
          <Route path="/login" element={<div data-testid="login" />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders the tree when signed in and unlocked", () => {
    mockAccessToken = "token";
    mockKey = {} as CryptoKey;
    renderGuarded();
    expect(screen.getByTestId("tree")).toBeInTheDocument();
  });

  it("renders nothing behind the unlock modal when the key is gone", () => {
    mockAccessToken = "token";
    mockKey = null;
    renderGuarded();
    expect(screen.queryByTestId("tree")).not.toBeInTheDocument();
    expect(screen.queryByText("Anna Smith")).not.toBeInTheDocument();
  });

  it("renders nothing behind the re-auth modal when the session expired", () => {
    mockAccessToken = null;
    mockWasAuthenticated = true;
    mockKey = {} as CryptoKey;
    renderGuarded();
    expect(screen.queryByTestId("tree")).not.toBeInTheDocument();
    mockWasAuthenticated = false;
  });

  it("sends someone who was never signed in to the login page", () => {
    mockAccessToken = null;
    mockWasAuthenticated = false;
    mockKey = null;
    renderGuarded();
    expect(screen.getByTestId("login")).toBeInTheDocument();
  });
});
