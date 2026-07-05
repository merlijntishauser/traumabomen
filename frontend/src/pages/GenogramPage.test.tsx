import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GenogramPage from "./GenogramPage";

vi.mock("react-i18next", () => ({
  // The page requests a fixed language via the lng option; surface it in the
  // returned keys so tests can assert the right language was used.
  useTranslation: (_ns?: string, options?: { lng?: string }) => ({
    t: (key: string) => `${options?.lng}:${key}`,
  }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("GenogramPage", () => {
  it("renders all sections in the fixed language, not the detected one", () => {
    render(<GenogramPage lang="en" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "en:genogram.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("en:genogram.whatTitle")).toBeInTheDocument();
    expect(screen.getByText("en:genogram.stepsTitle")).toBeInTheDocument();
    expect(screen.getByText("en:genogram.howTitle")).toBeInTheDocument();
    expect(screen.getByText("en:genogram.howPrivacyBody")).toBeInTheDocument();
    expect(screen.getByText("en:genogram.howLockBody")).toBeInTheDocument();
  });

  it("renders Dutch content on the genogram-maken variant", () => {
    render(<GenogramPage lang="nl" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "nl:genogram.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("nl:genogram.lede")).toBeInTheDocument();
  });

  it("links the CTA pair and the other-language page", () => {
    render(<GenogramPage lang="en" />);

    expect(screen.getByText("en:landing.ctaCreate").closest("a")).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByText("en:genogram.ctaDemo").closest("a")).toHaveAttribute("href", "/demo");
    expect(screen.getByText("en:genogram.otherLanguage").closest("a")).toHaveAttribute(
      "href",
      "/genogram-maken",
    );
  });

  it("links the Dutch page back to the English one", () => {
    render(<GenogramPage lang="nl" />);

    expect(screen.getByText("nl:genogram.otherLanguage").closest("a")).toHaveAttribute(
      "href",
      "/genogram",
    );
  });

  it("adds SoftwareApplication structured data to the head, removed on unmount", () => {
    const { unmount } = render(<GenogramPage lang="en" />);

    const script = document.head.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script?.textContent ?? "{}");
    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data.url).toBe("https://www.traumatrees.org/genogram");
    expect(data.offers.price).toBe("0");
    expect(data.inLanguage).toBe("en");

    unmount();
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("uses the Dutch canonical in the Dutch page's structured data", () => {
    render(<GenogramPage lang="nl" />);

    const script = document.head.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? "{}");
    expect(data.url).toBe("https://www.traumabomen.nl/genogram-maken");
    expect(data.inLanguage).toBe("nl");
  });

  it("sets the page title and meta description, restoring them on unmount", () => {
    document.title = "before";
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "original");
    document.head.appendChild(meta);

    const { unmount } = render(<GenogramPage lang="en" />);
    expect(document.title).toBe("en:genogram.title | en:app.title");
    expect(meta.getAttribute("content")).toBe("en:genogram.metaDescription");

    unmount();
    expect(document.title).toBe("before");
    expect(meta.getAttribute("content")).toBe("original");
    meta.remove();
  });

  it("gives every screenshot an alt text", () => {
    render(<GenogramPage lang="en" />);

    for (const img of screen.getAllByRole("img")) {
      expect(img).toHaveAttribute("alt");
      expect(img.getAttribute("alt")).not.toBe("");
    }
  });
});
