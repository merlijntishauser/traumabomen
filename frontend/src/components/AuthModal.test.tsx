import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthModal } from "./AuthModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

vi.mock("../lib/api", () => ({
  login: vi.fn(),
  getEncryptionSalt: vi.fn(),
}));

vi.mock("../lib/crypto", () => ({
  deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
  hashPassphrase: vi.fn().mockResolvedValue("hashed"),
}));

vi.mock("../lib/keyRingLoader", () => ({
  loadOrMigrateKeyRing: vi.fn().mockResolvedValue({
    keys: new Map(),
    base64Map: new Map(),
  }),
}));

const defaultProps = {
  mode: "unlock" as const,
  hint: null as string | null,
  salt: null as string | null,
  onUnlockSuccess: vi.fn(),
  onReauthSuccess: vi.fn(),
  onLogout: vi.fn(),
};

describe("AuthModal", () => {
  describe("unlock mode", () => {
    it("renders passphrase input in unlock mode", () => {
      render(<AuthModal {...defaultProps} salt="test-salt" />);
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    it("displays hint when provided", () => {
      render(<AuthModal {...defaultProps} salt="test-salt" hint="My book title" />);
      expect(screen.getByText("My book title")).toBeInTheDocument();
    });

    it("does not display hint block when hint is null", () => {
      render(<AuthModal {...defaultProps} salt="test-salt" />);
      expect(screen.queryByTestId("auth-modal-hint")).not.toBeInTheDocument();
    });

    it("shows switch account link", () => {
      render(<AuthModal {...defaultProps} salt="test-salt" />);
      expect(screen.getByText("auth.switchAccount")).toBeInTheDocument();
    });

    it("calls onUnlockSuccess after successful passphrase entry", async () => {
      render(<AuthModal {...defaultProps} salt="test-salt" />);
      fireEvent.change(screen.getByLabelText("auth.passphrase"), {
        target: { value: "my-passphrase" },
      });
      fireEvent.submit(screen.getByRole("form"));
      await waitFor(() => {
        expect(defaultProps.onUnlockSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("re-auth mode", () => {
    it("renders email and password inputs first", () => {
      render(<AuthModal {...defaultProps} mode="reauth" />);
      expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
      expect(screen.getByLabelText("auth.password")).toBeInTheDocument();
      expect(screen.queryByLabelText("auth.passphrase")).not.toBeInTheDocument();
    });
  });
});
