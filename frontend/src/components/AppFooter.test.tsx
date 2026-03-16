import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppFooter } from "./AppFooter";

let mockLanguage = "en";
let mockIsLoggedIn = true;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: {
      get language() {
        return mockLanguage;
      },
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

vi.mock("../lib/api", () => ({
  getAccessToken: () => (mockIsLoggedIn ? "stub" : null),
}));

vi.mock("react-router-dom", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("./FeedbackModal", () => ({
  FeedbackModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="feedback-modal">
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

describe("AppFooter", () => {
  afterEach(() => {
    mockLanguage = "en";
    mockIsLoggedIn = true;
  });

  it("renders without crashing", () => {
    const { container } = render(<AppFooter />);
    expect(container.querySelector("footer")).toBeTruthy();
  });

  it("contains the disclaimer text", () => {
    render(<AppFooter />);
    expect(screen.getByText("safety.footer.disclaimer")).toBeInTheDocument();
  });

  it("renders the mental health footer text", () => {
    render(<AppFooter />);
    expect(screen.getByText("mentalHealth.footer")).toBeInTheDocument();
  });

  it("renders lock button when onLock is provided", () => {
    const onLock = vi.fn();
    render(<AppFooter onLock={onLock} />);
    expect(screen.getByLabelText("safety.footer.lock")).toBeInTheDocument();
  });

  it("does not render lock button when onLock is not provided", () => {
    render(<AppFooter />);
    expect(screen.queryByLabelText("safety.footer.lock")).not.toBeInTheDocument();
  });

  it("renders feedback button with text label", () => {
    render(<AppFooter />);
    const btn = screen.getByLabelText("feedback.button");
    expect(btn).toBeInTheDocument();
    expect(btn.querySelector("span")).toBeTruthy();
    expect(btn.textContent).toContain("feedback.button");
    expect(btn.classList.contains("app-footer__btn--feedback")).toBe(true);
  });

  it("opens feedback modal on click", () => {
    render(<AppFooter />);
    expect(screen.queryByTestId("feedback-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("feedback.button"));
    expect(screen.getByTestId("feedback-modal")).toBeInTheDocument();
  });

  it("closes feedback modal via onClose", () => {
    render(<AppFooter />);
    fireEvent.click(screen.getByLabelText("feedback.button"));
    expect(screen.getByTestId("feedback-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByTestId("feedback-modal")).not.toBeInTheDocument();
  });

  it("calls onLock when lock button is clicked", () => {
    const onLock = vi.fn();
    render(<AppFooter onLock={onLock} />);
    fireEvent.click(screen.getByLabelText("safety.footer.lock"));
    expect(onLock).toHaveBeenCalled();
  });

  it("hides feedback button when not authenticated", () => {
    mockIsLoggedIn = false;
    render(<AppFooter />);
    expect(screen.queryByLabelText("feedback.button")).not.toBeInTheDocument();
  });

  it("shows feedback button when authenticated", () => {
    mockIsLoggedIn = true;
    render(<AppFooter />);
    expect(screen.getByLabelText("feedback.button")).toBeInTheDocument();
  });

  it("renders privacy link in colophon", () => {
    render(<AppFooter />);
    const colophon = document.querySelector(".app-footer__colophon");
    expect(colophon?.textContent).toContain("nav.privacy");
  });

  it("renders GitHub link in colophon", () => {
    render(<AppFooter />);
    const githubLink = screen.getByText("GitHub");
    expect(githubLink.tagName).toBe("A");
    expect(githubLink).toHaveAttribute("href", "https://github.com/merlijntishauser/traumabomen");
  });

  it("renders copyright with current year in colophon", () => {
    render(<AppFooter />);
    const year = new Date().getFullYear().toString();
    const colophon = document.querySelector(".app-footer__colophon");
    expect(colophon).toBeTruthy();
    expect(colophon?.textContent).toContain(year);
    expect(colophon?.textContent).toContain("Merlijn Tishauser");
  });

  it("renders AGPL-3.0 license link in colophon", () => {
    render(<AppFooter />);
    const licenseLink = screen.getByText("AGPL-3.0");
    expect(licenseLink).toBeInTheDocument();
    expect(licenseLink.tagName).toBe("A");
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/merlijntishauser/traumabomen/blob/main/LICENSE",
    );
    expect(licenseLink).toHaveAttribute("target", "_blank");
    expect(licenseLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows version and commit when both globals are set", () => {
    (globalThis as Record<string, unknown>).__APP_VERSION__ = "1.2.3";
    (globalThis as Record<string, unknown>).__APP_COMMIT__ = "abc1234";
    render(<AppFooter />);
    const version = document.querySelector(".app-footer__version");
    expect(version).toBeTruthy();
    expect(version?.textContent).toContain("1.2.3");
    expect(version?.textContent).toContain("abc1234");
    (globalThis as Record<string, unknown>).__APP_VERSION__ = "";
    (globalThis as Record<string, unknown>).__APP_COMMIT__ = "";
  });

  it("shows only version when commit is empty", () => {
    (globalThis as Record<string, unknown>).__APP_VERSION__ = "1.0.0";
    (globalThis as Record<string, unknown>).__APP_COMMIT__ = "";
    render(<AppFooter />);
    const version = document.querySelector(".app-footer__version");
    expect(version).toBeTruthy();
    expect(version?.textContent).toContain("1.0.0");
    expect(version?.textContent).not.toContain("(");
    (globalThis as Record<string, unknown>).__APP_VERSION__ = "";
  });

  it("shows only commit when version is empty", () => {
    (globalThis as Record<string, unknown>).__APP_VERSION__ = "";
    (globalThis as Record<string, unknown>).__APP_COMMIT__ = "def5678";
    render(<AppFooter />);
    const version = document.querySelector(".app-footer__version");
    expect(version).toBeTruthy();
    expect(version?.textContent).toContain("def5678");
    (globalThis as Record<string, unknown>).__APP_COMMIT__ = "";
  });

  it("hides version section when both globals are empty", () => {
    (globalThis as Record<string, unknown>).__APP_VERSION__ = "";
    (globalThis as Record<string, unknown>).__APP_COMMIT__ = "";
    render(<AppFooter />);
    const version = document.querySelector(".app-footer__version");
    expect(version).toBeNull();
  });
});
