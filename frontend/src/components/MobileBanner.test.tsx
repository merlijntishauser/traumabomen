import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBanner } from "./MobileBanner";

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
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const STORAGE_KEY = "traumabomen-mobile-dismissed";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Save originals so we can restore them
const originalUserAgent = navigator.userAgent;
const originalInnerWidth = window.innerWidth;

function setMobileEnvironment() {
  Object.defineProperty(navigator, "userAgent", {
    value: "iPhone",
    writable: true,
    configurable: true,
  });
}

function setDesktopEnvironment() {
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerWidth", {
    value: 1024,
    writable: true,
    configurable: true,
  });
}

describe("MobileBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    // Restore originals
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it("renders on a mobile device", () => {
    setMobileEnvironment();
    render(<MobileBanner />);
    expect(screen.getByText("common.mobileWarning")).toBeInTheDocument();
  });

  it("does not render on a desktop device", () => {
    setDesktopEnvironment();
    render(<MobileBanner />);
    expect(screen.queryByText("common.mobileWarning")).not.toBeInTheDocument();
  });

  it("renders a close button on mobile", () => {
    setMobileEnvironment();
    render(<MobileBanner />);
    expect(screen.getByLabelText("common.close")).toBeInTheDocument();
  });

  it("hides the banner when close button is clicked", () => {
    setMobileEnvironment();
    render(<MobileBanner />);

    fireEvent.click(screen.getByLabelText("common.close"));

    expect(screen.queryByText("common.mobileWarning")).not.toBeInTheDocument();
  });

  it("persists dismissal to localStorage", () => {
    setMobileEnvironment();
    render(<MobileBanner />);

    fireEvent.click(screen.getByLabelText("common.close"));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("does not render when previously dismissed", () => {
    setMobileEnvironment();
    localStorage.setItem(STORAGE_KEY, "1");
    render(<MobileBanner />);

    expect(screen.queryByText("common.mobileWarning")).not.toBeInTheDocument();
  });

  it("renders on small viewport even without mobile user agent", () => {
    setDesktopEnvironment();
    Object.defineProperty(window, "innerWidth", {
      value: 500,
      writable: true,
      configurable: true,
    });
    render(<MobileBanner />);
    expect(screen.getByText("common.mobileWarning")).toBeInTheDocument();
  });
});
