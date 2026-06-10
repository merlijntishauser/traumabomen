import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./LearnPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("LearnPage", () => {
  afterEach(() => {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      s.remove();
    }
  });

  it("renders the title, both content sections, and the closing CTA", () => {
    render(<LearnPage />);

    expect(screen.getByRole("heading", { level: 1, name: "learn.title" })).toBeInTheDocument();
    expect(screen.getByText("learn.whatTitle")).toBeInTheDocument();
    expect(screen.getByText("learn.mapTitle")).toBeInTheDocument();
    expect(screen.getByText("learn.whatBody1")).toBeInTheDocument();
    expect(screen.getByText("learn.mapBody3")).toBeInTheDocument();
    expect(screen.getByText("landing.ctaCreate").closest("a")).toHaveAttribute("href", "/register");
  });

  it("links all four references to external sources in a new tab", () => {
    render(<LearnPage />);

    for (const key of ["ref1", "ref2", "ref3", "ref4"]) {
      const link = screen.getByText(`learn.${key}Label`).closest("a");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link?.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("sets the document title and injects Article structured data", () => {
    render(<LearnPage />);

    expect(document.title).toContain("learn.title");
    const ld = document.querySelector('script[type="application/ld+json"]');
    expect(ld?.textContent).toContain('"Article"');
  });

  it("restores the document title on unmount", () => {
    document.title = "before";
    const { unmount } = render(<LearnPage />);
    unmount();
    expect(document.title).toBe("before");
  });
});
