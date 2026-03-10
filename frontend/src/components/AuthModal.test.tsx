import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "./AuthModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const mockLogin = vi.fn();
const mockGetEncryptionSalt = vi.fn();
vi.mock("../lib/api", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  getEncryptionSalt: (...args: unknown[]) => mockGetEncryptionSalt(...args),
  ApiError: class extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

const mockDeriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
const mockHashPassphrase = vi.fn().mockResolvedValue("hashed");
vi.mock("../lib/crypto", () => ({
  deriveKey: (...args: unknown[]) => mockDeriveKey(...args),
  hashPassphrase: (...args: unknown[]) => mockHashPassphrase(...args),
}));

const mockLoadOrMigrateKeyRing = vi.fn().mockResolvedValue({
  keys: new Map(),
  base64Map: new Map(),
});
vi.mock("../lib/keyRingLoader", () => ({
  loadOrMigrateKeyRing: (...args: unknown[]) => mockLoadOrMigrateKeyRing(...args),
}));

function makeProps(overrides?: Partial<Parameters<typeof AuthModal>[0]>) {
  return {
    mode: "unlock" as const,
    hint: null as string | null,
    salt: null as string | null,
    onUnlockSuccess: vi.fn(),
    onReauthSuccess: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
}

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue({ access_token: "tok", refresh_token: "ref" });
    mockGetEncryptionSalt.mockResolvedValue({
      encryption_salt: "fetched-salt",
      passphrase_hint: null,
    });
    mockDeriveKey.mockResolvedValue({} as CryptoKey);
    mockHashPassphrase.mockResolvedValue("hashed");
    mockLoadOrMigrateKeyRing.mockResolvedValue({
      keys: new Map(),
      base64Map: new Map(),
    });
  });

  describe("unlock mode", () => {
    it("renders passphrase input in unlock mode", () => {
      render(<AuthModal {...makeProps({ salt: "test-salt" })} />);
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    it("displays hint when provided", () => {
      render(<AuthModal {...makeProps({ salt: "test-salt", hint: "My book title" })} />);
      expect(screen.getByText("My book title")).toBeInTheDocument();
    });

    it("does not display hint block when hint is null", () => {
      render(<AuthModal {...makeProps({ salt: "test-salt" })} />);
      expect(screen.queryByTestId("auth-modal-hint")).not.toBeInTheDocument();
    });

    it("shows switch account link", () => {
      render(<AuthModal {...makeProps({ salt: "test-salt" })} />);
      expect(screen.getByText("auth.switchAccount")).toBeInTheDocument();
    });

    it("calls onUnlockSuccess after successful passphrase entry", async () => {
      const props = makeProps({ salt: "test-salt" });
      render(<AuthModal {...props} />);
      fireEvent.change(screen.getByLabelText("auth.passphrase"), {
        target: { value: "my-passphrase" },
      });
      fireEvent.submit(screen.getByLabelText("auth.passphrase").closest("form")!);
      await waitFor(() => {
        expect(props.onUnlockSuccess).toHaveBeenCalled();
      });
    });

    it("shows error when passphrase derivation fails", async () => {
      mockDeriveKey.mockRejectedValueOnce(new Error("bad passphrase"));
      render(<AuthModal {...makeProps({ salt: "test-salt" })} />);
      fireEvent.change(screen.getByLabelText("auth.passphrase"), {
        target: { value: "wrong" },
      });
      fireEvent.submit(screen.getByLabelText("auth.passphrase").closest("form")!);
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseError");
      });
    });

    it("calls onLogout when switch account is clicked", () => {
      const props = makeProps({ salt: "test-salt" });
      render(<AuthModal {...props} />);
      fireEvent.click(screen.getByText("auth.switchAccount"));
      expect(props.onLogout).toHaveBeenCalled();
    });

    it("does not submit when salt is null", async () => {
      render(<AuthModal {...makeProps()} />);
      fireEvent.change(screen.getByLabelText("auth.passphrase"), {
        target: { value: "my-passphrase" },
      });
      fireEvent.submit(screen.getByLabelText("auth.passphrase").closest("form")!);
      // deriveKey should never be called without salt
      await waitFor(() => {
        expect(mockDeriveKey).not.toHaveBeenCalled();
      });
    });
  });

  describe("re-auth mode", () => {
    it("renders email and password inputs first", () => {
      render(<AuthModal {...makeProps({ mode: "reauth" })} />);
      expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
      expect(screen.getByLabelText("auth.password")).toBeInTheDocument();
      expect(screen.queryByLabelText("auth.passphrase")).not.toBeInTheDocument();
    });

    it("shows step indicators", () => {
      render(<AuthModal {...makeProps({ mode: "reauth" })} />);
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("transitions to passphrase step after successful login", async () => {
      render(<AuthModal {...makeProps({ mode: "reauth" })} />);
      fireEvent.change(screen.getByLabelText("auth.email"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("auth.password"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByLabelText("auth.email").closest("form")!);

      await waitFor(() => {
        expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
      });
      expect(mockLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123", // eslint-disable-line sonarjs/no-hardcoded-passwords -- test fixture
      });
      expect(mockGetEncryptionSalt).toHaveBeenCalled();
    });

    it("shows error on login failure with ApiError", async () => {
      const { ApiError } = await import("../lib/api");
      mockLogin.mockRejectedValueOnce(new ApiError(401, "loginError"));
      render(<AuthModal {...makeProps({ mode: "reauth" })} />);
      fireEvent.change(screen.getByLabelText("auth.email"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("auth.password"), {
        target: { value: "wrong" },
      });
      fireEvent.submit(screen.getByLabelText("auth.email").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
      // Should still show credentials form
      expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    });

    it("shows generic error on non-API login failure", async () => {
      mockLogin.mockRejectedValueOnce(new Error("network error"));
      render(<AuthModal {...makeProps({ mode: "reauth" })} />);
      fireEvent.change(screen.getByLabelText("auth.email"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("auth.password"), {
        target: { value: "pass" },
      });
      fireEvent.submit(screen.getByLabelText("auth.email").closest("form")!);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("auth.loginError");
      });
    });

    it("calls onReauthSuccess after full re-auth flow", async () => {
      const props = makeProps({ mode: "reauth" });
      render(<AuthModal {...props} />);

      // Step 1: credentials
      fireEvent.change(screen.getByLabelText("auth.email"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("auth.password"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByLabelText("auth.email").closest("form")!);

      // Step 2: passphrase
      await waitFor(() => {
        expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText("auth.passphrase"), {
        target: { value: "my-passphrase" },
      });
      fireEvent.submit(screen.getByLabelText("auth.passphrase").closest("form")!);

      await waitFor(() => {
        expect(props.onReauthSuccess).toHaveBeenCalled();
      });
      // onUnlockSuccess should NOT be called in reauth mode
      expect(props.onUnlockSuccess).not.toHaveBeenCalled();
    });

    it("displays hint fetched after login", async () => {
      mockGetEncryptionSalt.mockResolvedValueOnce({
        encryption_salt: "fetched-salt",
        passphrase_hint: "Remember your cat", // eslint-disable-line sonarjs/no-hardcoded-passwords -- test fixture
      });
      render(<AuthModal {...makeProps({ mode: "reauth" })} />);

      fireEvent.change(screen.getByLabelText("auth.email"), {
        target: { value: "user@example.com" },
      });
      fireEvent.change(screen.getByLabelText("auth.password"), {
        target: { value: "pass" },
      });
      fireEvent.submit(screen.getByLabelText("auth.email").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("Remember your cat")).toBeInTheDocument();
      });
    });
  });
});
