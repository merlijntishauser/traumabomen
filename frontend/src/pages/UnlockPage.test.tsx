import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UnlockPage from "./UnlockPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("../components/AuthHero", () => ({
  AuthHero: ({ variant }: { variant?: string }) => <div data-testid="auth-hero">{variant}</div>,
}));

const mockSetMasterKey = vi.fn();
const mockSetPassphraseHash = vi.fn();
const mockSetTreeKeys = vi.fn();
const mockSetKeyRingBase64 = vi.fn();
const mockSetIsMigrated = vi.fn();

vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({
    setMasterKey: mockSetMasterKey,
    setPassphraseHash: mockSetPassphraseHash,
    setTreeKeys: mockSetTreeKeys,
    setKeyRingBase64: mockSetKeyRingBase64,
    setIsMigrated: mockSetIsMigrated,
  }),
}));

const mockNavigate = vi.fn();
let mockLocationState: { from?: string } | null = null;
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
}));

const mockGetEncryptionSalt = vi.fn();
const mockClearTokens = vi.fn();
vi.mock("../lib/api", () => ({
  getEncryptionSalt: (...args: unknown[]) => mockGetEncryptionSalt(...args),
  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
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

const mockDeriveKey = vi.fn();
const mockHashPassphrase = vi.fn();
vi.mock("../lib/crypto", () => ({
  deriveKey: (...args: unknown[]) => mockDeriveKey(...args),
  hashPassphrase: (...args: unknown[]) => mockHashPassphrase(...args),
}));

const mockLoadOrMigrateKeyRing = vi.fn();
vi.mock("../lib/keyRingLoader", () => ({
  loadOrMigrateKeyRing: (...args: unknown[]) => mockLoadOrMigrateKeyRing(...args),
}));

describe("UnlockPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState = null;
    mockGetEncryptionSalt.mockResolvedValue({
      encryption_salt: "test-salt",
      passphrase_hint: null,
    });
    mockDeriveKey.mockResolvedValue({} as CryptoKey);
    mockHashPassphrase.mockResolvedValue("hashed-passphrase");
    mockLoadOrMigrateKeyRing.mockResolvedValue({
      keys: new Map(),
      base64Map: new Map(),
    });
  });

  function renderPage() {
    return render(<UnlockPage />);
  }

  // -- Initial loading state --

  it("shows loading state while salt is being fetched", () => {
    // Do not resolve the salt promise immediately
    mockGetEncryptionSalt.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.getByText("app.title")).toBeInTheDocument();
  });

  it("renders auth hero with unlock variant", async () => {
    renderPage();
    // Wait for the salt fetch effect to settle
    await waitFor(() => {
      expect(screen.getByTestId("auth-hero")).toHaveTextContent("unlock");
    });
  });

  // -- Salt loaded: form rendered --

  it("renders passphrase form after salt loads", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });
    expect(screen.getByText("auth.passphrasePrompt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "auth.unlock" })).toBeInTheDocument();
  });

  it("renders the switch account button", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("auth.switchAccount")).toBeInTheDocument();
    });
  });

  // -- Passphrase hint display --

  it("displays the passphrase hint when present in salt response", async () => {
    mockGetEncryptionSalt.mockResolvedValue({
      encryption_salt: "test-salt",
      passphrase_hint: "My favorite color", // eslint-disable-line sonarjs/no-hardcoded-passwords -- test fixture
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("auth.hintLabel")).toBeInTheDocument();
      expect(screen.getByText("My favorite color")).toBeInTheDocument();
    });
  });

  it("does not display the hint block when passphrase_hint is null", async () => {
    mockGetEncryptionSalt.mockResolvedValue({
      encryption_salt: "test-salt",
      passphrase_hint: null,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    expect(screen.queryByText("auth.hintLabel")).not.toBeInTheDocument();
  });

  // -- Salt loading failure: redirect --

  it("navigates to login when salt fetch fails with 401", async () => {
    const { ApiError } = await import("../lib/api");
    mockGetEncryptionSalt.mockRejectedValue(new ApiError(401, "token_expired"));
    renderPage();

    await waitFor(() => {
      expect(mockClearTokens).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("navigates to login when salt fetch fails with non-401 error", async () => {
    mockGetEncryptionSalt.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
    // Should not clear tokens for non-auth errors
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  // -- Successful unlock --

  it("derives key and navigates to /trees on successful unlock", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "my-secret-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      expect(mockDeriveKey).toHaveBeenCalledWith("my-secret-passphrase", "test-salt");
      expect(mockHashPassphrase).toHaveBeenCalledWith("my-secret-passphrase");
      expect(mockSetMasterKey).toHaveBeenCalled();
      expect(mockSetPassphraseHash).toHaveBeenCalledWith("hashed-passphrase");
      expect(mockLoadOrMigrateKeyRing).toHaveBeenCalled();
      expect(mockSetTreeKeys).toHaveBeenCalled();
      expect(mockSetKeyRingBase64).toHaveBeenCalled();
      expect(mockSetIsMigrated).toHaveBeenCalledWith(true);
      expect(mockNavigate).toHaveBeenCalledWith("/trees", { replace: true });
    });
  });

  // -- Return to original route --

  it("navigates to the returnTo route from location state", async () => {
    mockLocationState = { from: "/trees/abc-123" };
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "my-secret-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/trees/abc-123", { replace: true });
    });
  });

  // -- Wrong passphrase / derivation failure --

  it("shows error when key derivation fails", async () => {
    mockDeriveKey.mockRejectedValue(new Error("Derivation failed"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "wrong-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseError");
    });
  });

  it("shows error when key ring migration fails", async () => {
    mockLoadOrMigrateKeyRing.mockRejectedValue(new Error("Migration failed"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "my-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseError");
    });
  });

  // -- Loading state --

  it("shows derivingKey text and disables button while loading", async () => {
    let resolveDeriveKey: (value: unknown) => void;
    mockDeriveKey.mockReturnValue(
      new Promise((resolve) => {
        resolveDeriveKey = resolve;
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "my-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "auth.derivingKey" });
      expect(btn).toBeDisabled();
    });

    // Resolve to clean up
    resolveDeriveKey!({} as CryptoKey);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  // -- Migrating state --

  it("shows migratingData text during key ring migration", async () => {
    let resolveKeyRing: (value: unknown) => void;
    mockLoadOrMigrateKeyRing.mockReturnValue(
      new Promise((resolve) => {
        resolveKeyRing = resolve;
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "my-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.migratingData" })).toBeInTheDocument();
    });

    // Resolve to clean up
    resolveKeyRing!({ keys: new Map(), base64Map: new Map() });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  // -- No error shown before submission --

  it("does not show an error message before form submission", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Logout / switch account --

  it("clears tokens and navigates to login on switch account click", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("auth.switchAccount")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("auth.switchAccount"));
    expect(mockClearTokens).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  // -- Does not submit when salt is not yet loaded --

  it("does not submit when salt is null", async () => {
    mockGetEncryptionSalt.mockReturnValue(new Promise(() => {}));
    renderPage();

    // The form is not rendered yet (loading state), so submit cannot occur
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByLabelText("auth.passphrase")).not.toBeInTheDocument();
  });

  // -- Re-enable button after error --

  it("re-enables the submit button after an error", async () => {
    mockDeriveKey.mockRejectedValue(new Error("fail"));
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("auth.passphrase"), {
      target: { value: "wrong-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Button should be re-enabled
    const btn = screen.getByRole("button", { name: "auth.unlock" });
    expect(btn).not.toBeDisabled();
  });
});
