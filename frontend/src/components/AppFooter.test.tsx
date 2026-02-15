import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFooter } from "./AppFooter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("./ThemeToggle", () => ({
  ThemeToggle: ({ className }: { className?: string }) => (
    <button type="button" className={className}>
      theme-toggle
    </button>
  ),
}));

describe("AppFooter", () => {
  it("renders without crashing", () => {
    const { container } = render(<AppFooter />);
    expect(container.querySelector("footer")).toBeTruthy();
  });

  it("contains copyright text with current year", () => {
    render(<AppFooter />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it("contains a privacy link", () => {
    render(<AppFooter />);
    expect(screen.getByText("privacy.title")).toBeInTheDocument();
  });

  it("contains a GitHub link", () => {
    render(<AppFooter />);
    expect(screen.getByLabelText("GitHub")).toBeInTheDocument();
  });

  it("renders a language toggle button", () => {
    render(<AppFooter />);
    // When language is "en", button text is "NL"
    expect(screen.getByText("NL")).toBeInTheDocument();
  });

  it("renders the mental health footer text", () => {
    render(<AppFooter />);
    expect(screen.getByText("mentalHealth.footer")).toBeInTheDocument();
  });

  it("renders the theme toggle", () => {
    render(<AppFooter />);
    expect(screen.getByText("theme-toggle")).toBeInTheDocument();
  });
});
