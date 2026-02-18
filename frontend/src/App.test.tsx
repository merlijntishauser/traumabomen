import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingGuard } from "./App";

let mockKey: CryptoKey | null = null;
let mockAccessToken: string | null = null;
let mockOnboardingFlag = false;

vi.mock("./contexts/EncryptionContext", () => ({
  useEncryption: () => ({ key: mockKey }),
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
