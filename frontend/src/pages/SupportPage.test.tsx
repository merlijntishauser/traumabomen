import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupportPage from "./SupportPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../components/BackHome", () => ({
  BackHome: () => <div data-testid="back-home" />,
}));

describe("SupportPage", () => {
  it("renders the title and every section heading", () => {
    render(<SupportPage />);

    expect(screen.getByRole("heading", { level: 1, name: "support.title" })).toBeInTheDocument();
    for (const heading of [
      "support.contact.heading",
      "support.faq.heading",
      "support.passphrase.heading",
      "support.crisis.heading",
      "support.security.heading",
      "support.more.heading",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    }
  });

  it("offers a reachable support address, which is the point of the page", () => {
    render(<SupportPage />);

    const link = screen.getByRole("link", { name: "support@traumatrees.org" });
    expect(link).toHaveAttribute("href", "mailto:support@traumatrees.org");
  });

  it("keeps security reports on the separate disclosure address", () => {
    render(<SupportPage />);

    expect(screen.getByRole("link", { name: "security@traumatrees.org" })).toHaveAttribute(
      "href",
      "mailto:security@traumatrees.org",
    );
  });

  it("renders every question with an answer", () => {
    render(<SupportPage />);

    for (const id of ["login", "passphrase", "waitlist", "delete", "export", "mobile"]) {
      expect(screen.getByText(`support.faq.${id}.q`)).toBeInTheDocument();
      expect(screen.getByText(`support.faq.${id}.a`)).toBeInTheDocument();
    }
  });

  it("states the unrecoverable passphrase plainly rather than burying it", () => {
    render(<SupportPage />);

    expect(screen.getByText("support.passphrase.warning")).toBeInTheDocument();
  });

  it("opens the crisis resource in a new tab without leaking the referrer", () => {
    render(<SupportPage />);

    const link = screen.getByRole("link", { name: "support.crisis.link" });
    expect(link).toHaveAttribute("href", "https://www.crisistextline.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
