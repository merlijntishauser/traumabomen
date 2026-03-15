import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MentalHealthBanner } from "./MentalHealthBanner";

// Provide a simple in-memory localStorage mock for the test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

const STORAGE_KEY = "mentalHealthBannerDismissed";

let mockLanguage = "en";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: {
      get language() {
        return mockLanguage;
      },
    },
  }),
  Trans: ({ i18nKey, values }: { i18nKey: string; values?: Record<string, string> }) => (
    <span>
      {i18nKey}
      {values?.resource && <span data-testid="resource-name">{values.resource}</span>}
    </span>
  ),
}));

describe("MentalHealthBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the banner when not dismissed", () => {
    render(<MentalHealthBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders the mental health banner text", () => {
    render(<MentalHealthBanner />);
    expect(screen.getByText("mentalHealth.banner")).toBeInTheDocument();
  });

  it("renders a dismiss button", () => {
    render(<MentalHealthBanner />);
    expect(screen.getByLabelText("common.close")).toBeInTheDocument();
  });

  it("hides the banner when dismiss button is clicked", () => {
    render(<MentalHealthBanner />);
    const closeButton = screen.getByLabelText("common.close");

    fireEvent.click(closeButton);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("persists dismissal to localStorage", () => {
    render(<MentalHealthBanner />);
    fireEvent.click(screen.getByLabelText("common.close"));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("does not render when previously dismissed", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<MentalHealthBanner />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses Dutch resource when language is nl", () => {
    mockLanguage = "nl";
    render(<MentalHealthBanner />);
    expect(screen.getByTestId("resource-name").textContent).toBe("Wij zijn Mind");
    mockLanguage = "en";
  });

  it("falls back to English resource for unsupported language", () => {
    mockLanguage = "fr";
    render(<MentalHealthBanner />);
    expect(screen.getByTestId("resource-name").textContent).toBe("Crisis Text Line");
    mockLanguage = "en";
  });
});
