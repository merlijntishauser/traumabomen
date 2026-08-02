import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFoundPage from "./NotFoundPage";

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

describe("NotFoundPage", () => {
  afterEach(() => {
    for (const m of document.querySelectorAll('meta[name="robots"]')) {
      m.remove();
    }
  });

  it("says the page does not exist rather than asking for a login", () => {
    render(<NotFoundPage />);

    expect(screen.getByRole("heading", { level: 1, name: "notFound.title" })).toBeInTheDocument();
    expect(screen.getByText("notFound.body")).toBeInTheDocument();
  });

  it("offers a way out", () => {
    render(<NotFoundPage />);

    expect(screen.getByRole("link", { name: "notFound.home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "nav.support" })).toHaveAttribute("href", "/support");
  });

  // The app answers every URL with 200, so noindex is the only thing stopping
  // a mistyped link from being indexed as a soft 404.
  it("marks itself noindex while it is on screen", () => {
    const { unmount } = render(<NotFoundPage />);

    const robots = document.querySelector('meta[name="robots"]');
    expect(robots).not.toBeNull();
    expect(robots?.getAttribute("content")).toBe("noindex, follow");

    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("restores the previous document title on the way out", () => {
    document.title = "Traumatrees";

    const { unmount } = render(<NotFoundPage />);
    expect(document.title).toBe("notFound.title | app.title");

    unmount();
    expect(document.title).toBe("Traumatrees");
  });
});
