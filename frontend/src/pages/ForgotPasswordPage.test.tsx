import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./ForgotPasswordPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
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
}));

vi.mock("../components/AuthHero", () => ({
  AuthHero: () => <div data-testid="auth-hero" />,
}));

const mockForgotPassword = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/api", () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email field and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    expect(screen.getByText("auth.sendResetLink")).toBeInTheDocument();
  });

  it("submit calls forgotPassword with email and language", async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByText("auth.sendResetLink"));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        language: "en",
      });
    });
  });

  it("shows success message after submit", async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByText("auth.sendResetLink"));

    await waitFor(() => {
      expect(screen.getByText("auth.forgotPasswordSent")).toBeInTheDocument();
    });
  });

  it("shows error on API failure", async () => {
    mockForgotPassword.mockRejectedValueOnce(new Error("Network error"));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByText("auth.sendResetLink"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("common.error");
    });
  });

  it("has a back to login link", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText("auth.backToLogin");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });
});
