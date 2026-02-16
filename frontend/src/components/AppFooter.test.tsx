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

  it("contains the disclaimer text", () => {
    render(<AppFooter />);
    expect(screen.getByText("safety.footer.disclaimer")).toBeInTheDocument();
  });

  it("contains a privacy link", () => {
    render(<AppFooter />);
    expect(screen.getByLabelText("safety.footer.privacy")).toBeInTheDocument();
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

  it("renders lock button when onLock is provided", () => {
    const onLock = vi.fn();
    render(<AppFooter onLock={onLock} />);
    expect(screen.getByLabelText("safety.footer.lock")).toBeInTheDocument();
  });

  it("does not render lock button when onLock is not provided", () => {
    render(<AppFooter />);
    expect(screen.queryByLabelText("safety.footer.lock")).not.toBeInTheDocument();
  });
});
