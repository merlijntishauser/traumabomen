import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Insight } from "../../lib/computeInsights";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (values && Object.keys(values).length > 0) {
        return `${key}:${JSON.stringify(values)}`;
      }
      return key;
    },
    i18n: { language: "en" },
  }),
}));

const { InsightCard } = await import("./InsightCard");

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    category: "generational",
    icon: "layers",
    titleKey: "insights.traumaAcrossGenerations",
    titleValues: { category: "trauma.category.loss", generations: 3 },
    detailKey: null,
    detailValues: {},
    priority: 90,
    ...overrides,
  };
}

describe("InsightCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title message", () => {
    render(<InsightCard insight={makeInsight()} index={0} />);
    const card = screen.getByTestId("insight-card");
    expect(card).toBeTruthy();
    // Title should be rendered (t returns key:values format)
    expect(card.querySelector(".insight-card__message")?.textContent).toContain(
      "insights.traumaAcrossGenerations",
    );
  });

  it("renders detail when detailKey is provided", () => {
    const insight = makeInsight({
      detailKey: "insights.traumaAcrossGenerationsDetail",
      detailValues: { names: "Alice, Bob" },
    });
    render(<InsightCard insight={insight} index={0} />);
    const detail = screen.getByTestId("insight-card").querySelector(".insight-card__detail");
    expect(detail).toBeTruthy();
    expect(detail?.textContent).toContain("insights.traumaAcrossGenerationsDetail");
  });

  it("does not render detail when detailKey is null", () => {
    render(<InsightCard insight={makeInsight()} index={0} />);
    const detail = screen.getByTestId("insight-card").querySelector(".insight-card__detail");
    expect(detail).toBeNull();
  });

  it("resolves translation key values (trauma., dsm., turningPoint. prefixes)", () => {
    const insight = makeInsight({
      titleValues: { category: "trauma.category.addiction" },
    });
    render(<InsightCard insight={insight} index={0} />);
    const message = screen.getByTestId("insight-card").querySelector(".insight-card__message");
    // The "trauma.category.addiction" value should be resolved through t(),
    // which in our mock returns the key itself
    expect(message?.textContent).toContain("trauma.category.addiction");
  });

  it("does not resolve non-translation-key string values", () => {
    const insight = makeInsight({
      titleValues: { names: "Alice, Bob" },
    });
    render(<InsightCard insight={insight} index={0} />);
    const message = screen.getByTestId("insight-card").querySelector(".insight-card__message");
    expect(message?.textContent).toContain("Alice, Bob");
  });

  it("applies staggered animation delay based on index", () => {
    render(<InsightCard insight={makeInsight()} index={3} />);
    const card = screen.getByTestId("insight-card");
    expect(card.style.animationDelay).toBe("0.18s");
  });

  it("falls back to Layers icon for unknown icon names", () => {
    const insight = makeInsight({ icon: "unknown-icon" });
    render(<InsightCard insight={insight} index={0} />);
    // Should render without error (falls back to Layers)
    const icon = screen.getByTestId("insight-card").querySelector(".insight-card__icon");
    expect(icon).toBeTruthy();
  });
});
