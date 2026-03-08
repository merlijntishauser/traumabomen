import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockChangePassword = vi.fn();

vi.mock("../../../lib/api", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

import { ChangePasswordSection } from "./ChangePasswordSection";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangePasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByText("account.changePassword")).toBeInTheDocument();
  });

  it("renders three password input fields", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByPlaceholderText("account.currentPassword")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.newPassword")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.confirmNewPassword")).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  it("disables save button when all fields are empty", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("disables save button when only current password is filled", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "oldpass123");

    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("disables save button when password is too weak", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "oldpass123");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "short");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "short");

    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("enables save button when all fields filled and password is strong enough", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "OldPassword1!");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "NewStrongPass1!");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "NewStrongPass1!");

    expect(screen.getByText("common.save")).toBeEnabled();
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "OldPassword1!");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "NewStrongPass1!");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "DifferentPass1!");
    await user.click(screen.getByText("common.save"));

    expect(screen.getByText("account.passwordMismatch")).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows error when new password is weak even if matching", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    // Password length >= 8 but score <= 2 means "weak"
    // "abcdefgh" has length 8, only lowercase, score=1 -> weak
    await user.type(screen.getByPlaceholderText("account.currentPassword"), "OldPassword1!");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "abcdefgh");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "abcdefgh");

    // Button should be disabled due to weak password
    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("calls changePassword API and shows success on valid submission", async () => {
    mockChangePassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "OldPassword1!");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "NewStrongPass1!");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "NewStrongPass1!");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(screen.getByText("account.passwordChanged")).toBeInTheDocument();
    });

    expect(mockChangePassword).toHaveBeenCalledWith({
      current_password: "OldPassword1!",
      new_password: "NewStrongPass1!",
    });
  });

  it("clears fields after successful password change", async () => {
    mockChangePassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "OldPassword1!");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "NewStrongPass1!");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "NewStrongPass1!");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("account.currentPassword")).toHaveValue("");
      expect(screen.getByPlaceholderText("account.newPassword")).toHaveValue("");
      expect(screen.getByPlaceholderText("account.confirmNewPassword")).toHaveValue("");
    });
  });

  it("shows error message when API call fails", async () => {
    mockChangePassword.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    render(<ChangePasswordSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassword"), "OldPassword1!");
    await user.type(screen.getByPlaceholderText("account.newPassword"), "NewStrongPass1!");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassword"), "NewStrongPass1!");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(screen.getByText("account.passwordError")).toBeInTheDocument();
    });
  });

  it("renders PasswordStrengthMeter when new password has content", async () => {
    const user = userEvent.setup();
    const { container } = render(<ChangePasswordSection />);

    // Meter should not be present initially (empty password)
    expect(container.querySelector(".password-meter")).toBeNull();

    await user.type(screen.getByPlaceholderText("account.newPassword"), "StrongPass1!");

    // Meter should appear after typing
    expect(container.querySelector(".password-meter")).not.toBeNull();
  });

  it("has maxLength 64 on new password field", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByPlaceholderText("account.newPassword")).toHaveAttribute("maxLength", "64");
  });

  it("has autocomplete attributes on password fields", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByPlaceholderText("account.currentPassword")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByPlaceholderText("account.newPassword")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByPlaceholderText("account.confirmNewPassword")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });
});
