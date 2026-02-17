import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import WaitlistPage from "./WaitlistPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("../components/AuthHero", () => ({
  AuthHero: () => <div data-testid="auth-hero" />,
}));

const mockJoinWaitlist = vi.fn();
vi.mock("../lib/api", () => ({
  joinWaitlist: (...args: unknown[]) => mockJoinWaitlist(...args),
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
      this.name = "ApiError";
    }
  },
}));

describe("WaitlistPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <WaitlistPage />
      </MemoryRouter>,
    );
  }

  it("renders the waitlist form", () => {
    renderPage();
    expect(screen.getByText("waitlist.title")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    expect(screen.getByText("waitlist.joinButton")).toBeInTheDocument();
  });

  it("shows success message on successful join", async () => {
    mockJoinWaitlist.mockResolvedValue({ message: "joined_waitlist" });
    renderPage();

    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByText("waitlist.joinButton"));

    await waitFor(() => {
      expect(screen.getByText("waitlist.success")).toBeInTheDocument();
    });
  });

  it("shows error when already on waitlist", async () => {
    const { ApiError } = await import("../lib/api");
    mockJoinWaitlist.mockRejectedValue(new ApiError(409, "already_on_waitlist"));
    renderPage();

    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByText("waitlist.joinButton"));

    await waitFor(() => {
      expect(screen.getByText("waitlist.alreadyOnList")).toBeInTheDocument();
    });
  });

  it("shows error when already registered", async () => {
    const { ApiError } = await import("../lib/api");
    mockJoinWaitlist.mockRejectedValue(new ApiError(409, "already_registered"));
    renderPage();

    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByText("waitlist.joinButton"));

    await waitFor(() => {
      expect(screen.getByText("waitlist.alreadyRegistered")).toBeInTheDocument();
    });
  });
});
