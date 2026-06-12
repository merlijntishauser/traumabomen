import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TourPage from "./TourPage";

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

describe("TourPage", () => {
  afterEach(() => {
    document.title = "";
  });

  it("renders the title, the fictional-data note, and all three stops", () => {
    render(<TourPage />);

    expect(screen.getByRole("heading", { level: 1, name: "tour.title" })).toBeInTheDocument();
    expect(screen.getByText("tour.note")).toBeInTheDocument();
    expect(screen.getByText("tour.canvasTitle")).toBeInTheDocument();
    expect(screen.getByText("tour.timelineTitle")).toBeInTheDocument();
    expect(screen.getByText("tour.patternsTitle")).toBeInTheDocument();
  });

  it("shows a theme-aware screenshot pair per stop", () => {
    render(<TourPage />);

    // 3 stops x 2 theme variants
    expect(screen.getAllByRole("img")).toHaveLength(6);
    const patternImgs = screen.getAllByAltText("tour.shotPatternsAlt");
    expect(patternImgs).toHaveLength(2);
    expect(patternImgs[0].getAttribute("src")).toContain("glimpse-patterns-dark");
  });

  it("sets the document title and links the closing CTA to register", () => {
    render(<TourPage />);

    expect(document.title).toContain("tour.title");
    expect(screen.getByText("landing.ctaCreate").closest("a")).toHaveAttribute("href", "/register");
  });
});
