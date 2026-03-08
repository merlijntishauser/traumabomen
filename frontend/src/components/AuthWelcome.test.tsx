import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthWelcome } from "./AuthWelcome";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <AuthWelcome />
    </MemoryRouter>,
  );
}

describe("AuthWelcome", () => {
  it("renders title, tagline, and about text", () => {
    renderWithRouter();
    expect(screen.getByText("app.title")).toBeInTheDocument();
    expect(screen.getByText("landing.tagline")).toBeInTheDocument();
    expect(screen.getByText("landing.about")).toBeInTheDocument();
  });

  it("renders three feature list items", () => {
    renderWithRouter();
    expect(screen.getByText("landing.feature1")).toBeInTheDocument();
    expect(screen.getByText("landing.feature2")).toBeInTheDocument();
    expect(screen.getByText("landing.feature3")).toBeInTheDocument();
  });

  it("renders privacy section with link to /privacy", () => {
    renderWithRouter();
    expect(screen.getByText("landing.privacyHeading")).toBeInTheDocument();
    expect(screen.getByText("landing.privacy")).toBeInTheDocument();
    const link = screen.getByText("landing.readPrivacyPolicy");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/privacy");
  });
});
