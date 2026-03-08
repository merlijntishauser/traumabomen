import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_PW = "mypassword";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDeleteAccount = vi.fn();

vi.mock("../../../lib/api", () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

const mockLogout = vi.fn();
vi.mock("../../../hooks/useLogout", () => ({
  useLogout: () => mockLogout,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

import { DeleteAccountSection } from "./DeleteAccountSection";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeleteAccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and initial delete button", () => {
    render(<DeleteAccountSection />);
    const elements = screen.getAllByText("account.deleteAccount");
    expect(elements).toHaveLength(2);
    const heading = elements.find((el) => el.tagName === "H4");
    expect(heading).toBeDefined();
  });

  it("renders the initial delete button", () => {
    render(<DeleteAccountSection />);
    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON");
    expect(button).toBeDefined();
  });

  it("does not show confirmation fields initially", () => {
    render(<DeleteAccountSection />);
    expect(screen.queryByPlaceholderText("account.deleteConfirmLabel")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("account.deletePassword")).not.toBeInTheDocument();
    expect(screen.queryByText("account.deleteWarning")).not.toBeInTheDocument();
  });

  it("shows confirmation fields after clicking delete button", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    expect(screen.getByPlaceholderText("account.deleteConfirmLabel")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.deletePassword")).toBeInTheDocument();
    expect(screen.getByText("account.deleteWarning")).toBeInTheDocument();
    expect(screen.getByText("account.deleteButton")).toBeInTheDocument();
  });

  it("disables confirm delete button when confirmation text is empty", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    expect(screen.getByText("account.deleteButton")).toBeDisabled();
  });

  it("disables confirm delete button when confirmation text is wrong", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "delete");
    await user.type(screen.getByPlaceholderText("account.deletePassword"), TEST_PW);

    expect(screen.getByText("account.deleteButton")).toBeDisabled();
  });

  it("disables confirm delete button when password is empty", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "DELETE");

    expect(screen.getByText("account.deleteButton")).toBeDisabled();
  });

  it("enables confirm delete button when DELETE is typed and password is provided", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "DELETE");
    await user.type(screen.getByPlaceholderText("account.deletePassword"), TEST_PW);

    expect(screen.getByText("account.deleteButton")).toBeEnabled();
  });

  it("calls deleteAccount API and logout on successful deletion", async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "DELETE");
    await user.type(screen.getByPlaceholderText("account.deletePassword"), TEST_PW);
    await user.click(screen.getByText("account.deleteButton"));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith({ password: TEST_PW });
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it("shows error message when deletion fails", async () => {
    mockDeleteAccount.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "DELETE");
    await user.type(screen.getByPlaceholderText("account.deletePassword"), TEST_PW);
    await user.click(screen.getByText("account.deleteButton"));

    await waitFor(() => {
      expect(screen.getByText("account.deleteError")).toBeInTheDocument();
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("does not call logout when deletion fails", async () => {
    mockDeleteAccount.mockRejectedValue(new Error("Failed"));
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "DELETE");
    await user.type(screen.getByPlaceholderText("account.deletePassword"), TEST_PW);
    await user.click(screen.getByText("account.deleteButton"));

    await waitFor(() => {
      expect(screen.getByText("account.deleteError")).toBeInTheDocument();
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("has danger styling class on section", () => {
    const { container } = render(<DeleteAccountSection />);
    expect(container.querySelector(".settings-panel__section--danger")).not.toBeNull();
  });

  it("password field has autocomplete attribute", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    expect(screen.getByPlaceholderText("account.deletePassword")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("confirmation text field is type text (not password)", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    expect(screen.getByPlaceholderText("account.deleteConfirmLabel")).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("requires exact case-sensitive DELETE text", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    const elements = screen.getAllByText("account.deleteAccount");
    const button = elements.find((el) => el.tagName === "BUTTON")!;
    await user.click(button);

    await user.type(screen.getByPlaceholderText("account.deleteConfirmLabel"), "Delete");
    await user.type(screen.getByPlaceholderText("account.deletePassword"), TEST_PW);

    // "Delete" !== "DELETE", so button should be disabled
    expect(screen.getByText("account.deleteButton")).toBeDisabled();
  });
});
