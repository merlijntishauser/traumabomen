import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingGate } from "./OnboardingGate";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("../lib/api", () => ({
  acknowledgeOnboarding: vi.fn().mockResolvedValue(undefined),
}));

describe("OnboardingGate", () => {
  it("renders all four information blocks", () => {
    const onAcknowledged = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} />);

    expect(screen.getByText("safety.onboarding.whatThisIs")).toBeInTheDocument();
    expect(screen.getByText("safety.onboarding.whatThisMayBringUp")).toBeInTheDocument();
    expect(screen.getByText("safety.onboarding.tryDemo")).toBeInTheDocument();
    expect(screen.getByText("safety.onboarding.whatWeCannotSee")).toBeInTheDocument();
  });

  it("renders continue button", () => {
    const onAcknowledged = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} />);

    expect(screen.getByText("safety.onboarding.continue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "safety.onboarding.continue" })).toBeInTheDocument();
  });

  it("calls onAcknowledged after clicking continue", async () => {
    const { acknowledgeOnboarding } = await import("../lib/api");
    const onAcknowledged = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} />);

    const continueButton = screen.getByRole("button", { name: "safety.onboarding.continue" });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(acknowledgeOnboarding).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onAcknowledged).toHaveBeenCalledTimes(1);
    });
  });

  it("re-enables button when API call fails", async () => {
    const { acknowledgeOnboarding } = await import("../lib/api");
    (acknowledgeOnboarding as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));

    const onAcknowledged = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} />);

    const continueButton = screen.getByRole("button", { name: "safety.onboarding.continue" });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(continueButton).not.toBeDisabled();
    });

    expect(onAcknowledged).not.toHaveBeenCalled();
  });

  it("privacy link opens in a new tab", () => {
    const onAcknowledged = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} />);

    const link = screen.getByText("safety.footer.privacy");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
