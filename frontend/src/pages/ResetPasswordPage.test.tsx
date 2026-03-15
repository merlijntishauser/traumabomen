import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./ResetPasswordPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

let mockSearchParams = new URLSearchParams("token=test-token");
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
  useSearchParams: () => [mockSearchParams],
}));

vi.mock("../components/AuthHero", () => ({
  AuthHero: () => <div data-testid="auth-hero" />,
}));

const mockResetPassword = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/api", () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  ApiError: class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.name = "ApiError";
      this.status = status;
      this.detail = detail;
    }
  },
}));

const STUB_CREDENTIAL = "StrongPass123!";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("token=test-token");
  });

  it("shows error state when no token in URL", () => {
    mockSearchParams = new URLSearchParams("");
    render(<ResetPasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("auth.resetPasswordFailed");
  });

  it("renders password fields when token is present", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText("auth.newPassword")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.confirmNewPassword")).toBeInTheDocument();
    expect(screen.getByText("auth.resetPassword")).toBeInTheDocument();
  });

  it("shows mismatch error when passwords don't match", async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.newPassword"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("auth.confirmNewPassword"), {
      target: { value: "Different456!" },
    });
    fireEvent.click(screen.getByText("auth.resetPassword"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.newPasswordMismatch");
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("calls resetPassword on successful submit", async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.newPassword"), {
      target: { value: STUB_CREDENTIAL },
    });
    fireEvent.change(screen.getByLabelText("auth.confirmNewPassword"), {
      target: { value: STUB_CREDENTIAL },
    });
    fireEvent.click(screen.getByText("auth.resetPassword"));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        token: "test-token",
        new_password: STUB_CREDENTIAL, // eslint-disable-line sonarjs/no-hardcoded-passwords
      });
    });
  });

  it("shows success message after successful reset", async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.newPassword"), {
      target: { value: STUB_CREDENTIAL },
    });
    fireEvent.change(screen.getByLabelText("auth.confirmNewPassword"), {
      target: { value: STUB_CREDENTIAL },
    });
    fireEvent.click(screen.getByText("auth.resetPassword"));

    await waitFor(() => {
      expect(screen.getByText("auth.resetPasswordSuccess")).toBeInTheDocument();
    });
  });

  it("shows invalid/expired token error on API 400", async () => {
    const { ApiError } = await import("../lib/api");
    mockResetPassword.mockRejectedValueOnce(new ApiError(400, "invalid_or_expired_token"));
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("auth.newPassword"), {
      target: { value: STUB_CREDENTIAL },
    });
    fireEvent.change(screen.getByLabelText("auth.confirmNewPassword"), {
      target: { value: STUB_CREDENTIAL },
    });
    fireEvent.click(screen.getByText("auth.resetPassword"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.resetPasswordFailed");
    });
  });

  it("has link to request new reset when no token", () => {
    mockSearchParams = new URLSearchParams("");
    render(<ResetPasswordPage />);
    const link = screen.getByText("auth.requestNewReset");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/forgot-password");
  });
});
