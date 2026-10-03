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
  setOnboardingFlag: vi.fn(),
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

  it("lets the user in for this session when the server save fails", async () => {
    const { acknowledgeOnboarding, setOnboardingFlag } = await import("../lib/api");
    (acknowledgeOnboarding as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));

    const onAcknowledged = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} />);

    fireEvent.click(screen.getByRole("button", { name: "safety.onboarding.continue" }));

    await waitFor(() => {
      expect(onAcknowledged).toHaveBeenCalledTimes(1);
    });
    expect(setOnboardingFlag).toHaveBeenCalledWith(true);
  });

  it("starts the demo after acknowledging", async () => {
    const onAcknowledged = vi.fn();
    const onStartDemo = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} onStartDemo={onStartDemo} />);

    fireEvent.click(screen.getByRole("button", { name: "safety.onboarding.startWithDemo" }));

    await waitFor(() => {
      expect(onStartDemo).toHaveBeenCalledTimes(1);
    });
    expect(onAcknowledged).toHaveBeenCalledTimes(1);
  });

  it("hides the demo and exit actions when no handlers are given", () => {
    render(<OnboardingGate onAcknowledged={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "safety.onboarding.startWithDemo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "safety.onboarding.notNow" }),
    ).not.toBeInTheDocument();
  });

  it("offers a way out without acknowledging", () => {
    const onAcknowledged = vi.fn();
    const onLogout = vi.fn();
    render(<OnboardingGate onAcknowledged={onAcknowledged} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "safety.onboarding.notNow" }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onAcknowledged).not.toHaveBeenCalled();
  });

  it("links to support resources in a new tab", () => {
    render(<OnboardingGate onAcknowledged={vi.fn()} />);

    const link = screen.getByText("safety.onboarding.supportLink");
    expect(link).toHaveAttribute("href", "/support");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("moves initial focus to the title", () => {
    render(<OnboardingGate onAcknowledged={vi.fn()} />);

    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
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
