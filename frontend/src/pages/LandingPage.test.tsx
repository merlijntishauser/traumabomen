import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
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
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

const mockGetAccessToken = vi.fn();
vi.mock("../lib/api", () => ({
  getAccessToken: () => mockGetAccessToken(),
  // Empty live FAQ -> the landing falls back to the static i18n questions.
  getFaq: () => Promise.resolve({ entries: [] }),
}));

function renderLanding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LandingPage />
    </QueryClientProvider>,
  );
}

describe("LandingPage", () => {
  afterEach(() => {
    mockGetAccessToken.mockReset();
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      s.remove();
    }
  });

  it("renders title, CTAs, and sections when logged out", () => {
    mockGetAccessToken.mockReturnValue(null);
    renderLanding();

    expect(screen.getByRole("heading", { level: 1, name: "app.title" })).toBeInTheDocument();
    expect(screen.getByText("landing.heroTagline")).toBeInTheDocument();

    // Primary CTA goes to register, secondary to login.
    expect(screen.getAllByText("landing.ctaCreate")[0].closest("a")).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByText("landing.ctaSignIn").closest("a")).toHaveAttribute("href", "/login");

    // Key sections are present.
    expect(screen.getByText("landing.whatTitle")).toBeInTheDocument();
    expect(screen.getByText("landing.howTitle")).toBeInTheDocument();
    expect(screen.getByText("landing.faqTitle")).toBeInTheDocument();
    // Static fallback FAQ question is shown when the live FAQ is empty.
    expect(screen.getByText("landing.faqQ1")).toBeInTheDocument();
    expect(screen.getByText("landing.readPrivacyPolicy").closest("a")).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("injects FAQ structured data for search engines", () => {
    mockGetAccessToken.mockReturnValue(null);
    renderLanding();

    const ld = document.querySelector('script[type="application/ld+json"]');
    expect(ld).toBeTruthy();
    expect(ld?.textContent).toContain("FAQPage");
    expect(ld?.textContent).toContain("SoftwareApplication");
  });

  it("redirects logged-in visitors to the trees page", () => {
    mockGetAccessToken.mockReturnValue("a-token");
    renderLanding();

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/trees");
    // No marketing content or structured data when redirecting.
    expect(screen.queryByText("landing.howTitle")).not.toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
