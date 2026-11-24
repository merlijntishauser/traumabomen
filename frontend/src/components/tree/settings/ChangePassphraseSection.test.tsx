import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetEncryptionSalt = vi.fn();
const mockGetKeyRing = vi.fn();
const mockUpdateSalt = vi.fn();
const mockUpdateKeyRing = vi.fn();
const mockGetKeyPair = vi.fn();

const { MockApiError } = vi.hoisted(() => ({
  MockApiError: class MockApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail = "") {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
}));

vi.mock("../../../lib/api", () => ({
  ApiError: MockApiError,
  getKeyPair: (...args: unknown[]) => mockGetKeyPair(...args),
  getEncryptionSalt: (...args: unknown[]) => mockGetEncryptionSalt(...args),
  getKeyRing: (...args: unknown[]) => mockGetKeyRing(...args),
  updateSalt: (...args: unknown[]) => mockUpdateSalt(...args),
  updateKeyRing: (...args: unknown[]) => mockUpdateKeyRing(...args),
  getClassifications: vi.fn(),
  getEvents: vi.fn(),
  getJournalEntries: vi.fn(),
  getLifeEvents: vi.fn(),
  getPatterns: vi.fn(),
  getPersons: vi.fn(),
  getRelationships: vi.fn(),
  getTrees: vi.fn(),
  getTurningPoints: vi.fn(),
  syncTree: vi.fn(),
  updateTree: vi.fn(),
}));

const mockDeriveKey = vi.fn();
const mockDecryptKeyRing = vi.fn();
const mockEncryptKeyRing = vi.fn();
const mockGenerateSalt = vi.fn();
const mockDecryptFromApi = vi.fn();
const mockEncryptForApi = vi.fn();

vi.mock("../../../lib/crypto", () => ({
  decryptFromApi: (...args: unknown[]) => mockDecryptFromApi(...args),
  decryptKeyRing: (...args: unknown[]) => mockDecryptKeyRing(...args),
  deriveKey: (...args: unknown[]) => mockDeriveKey(...args),
  encryptForApi: (...args: unknown[]) => mockEncryptForApi(...args),
  encryptKeyRing: (...args: unknown[]) => mockEncryptKeyRing(...args),
  generateSalt: () => mockGenerateSalt(),
  hashPassphrase: () => Promise.resolve("mock-hash"),
}));

const mockSetMasterKey = vi.fn();
const mockSetPassphraseHash = vi.fn();
vi.mock("../../../contexts/useEncryption", () => ({
  useEncryption: () => ({
    isMigrated: true,
    setMasterKey: mockSetMasterKey,
    setPassphraseHash: mockSetPassphraseHash,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

import { ChangePassphraseSection } from "./ChangePassphraseSection";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangePassphraseSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKeyPair.mockRejectedValue(new MockApiError(404, "no_key_pair"));
  });

  function mockMigratedChange() {
    mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "old-salt" });
    mockDeriveKey.mockImplementation(async (passphrase: string) =>
      passphrase === "new-pass" ? "new-key" : "old-key",
    );
    mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "encrypted-ring" });
    mockDecryptKeyRing.mockResolvedValue({ tree1: "key1" });
    mockGenerateSalt.mockReturnValue("new-salt");
    mockEncryptKeyRing.mockResolvedValue("new-encrypted-ring");
    mockUpdateSalt.mockResolvedValue(undefined);
    mockUpdateKeyRing.mockResolvedValue(undefined);
  }

  async function submitChange() {
    const user = userEvent.setup();
    render(<ChangePassphraseSection />);
    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new-pass");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "new-pass");
    await user.click(screen.getByText("common.save"));
  }

  it("passphrase change sends the re-encrypted private key with the key ring", async () => {
    mockMigratedChange();
    mockGetKeyPair.mockResolvedValue({
      public_key: "pub-jwk",
      encrypted_private_key: "old-encrypted-private",
    });
    mockDecryptFromApi.mockResolvedValue("private-jwk");
    mockEncryptForApi.mockResolvedValue("new-encrypted-private");

    await submitChange();

    await waitFor(() => {
      expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
    });
    expect(mockDecryptFromApi).toHaveBeenCalledWith("old-encrypted-private", "old-key");
    expect(mockEncryptForApi).toHaveBeenCalledWith("private-jwk", "new-key");
    expect(mockUpdateKeyRing).toHaveBeenCalledOnce();
    expect(mockUpdateKeyRing).toHaveBeenCalledWith("new-encrypted-ring", "new-encrypted-private");
  });

  it("passphrase change without a key pair omits the field", async () => {
    mockMigratedChange();

    await submitChange();

    await waitFor(() => {
      expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
    });
    expect(mockUpdateKeyRing).toHaveBeenCalledOnce();
    expect(mockUpdateKeyRing.mock.calls[0][0]).toBe("new-encrypted-ring");
    expect(mockUpdateKeyRing.mock.calls[0][1]).toBeUndefined();
    expect(mockEncryptForApi).not.toHaveBeenCalled();
  });

  it("keeps the old passphrase when the key pair cannot be read", async () => {
    mockMigratedChange();
    mockGetKeyPair.mockRejectedValue(new MockApiError(500, "server_error"));

    await submitChange();

    await waitFor(() => {
      expect(screen.getByText("account.passphraseError")).toBeInTheDocument();
    });
    expect(mockUpdateSalt).not.toHaveBeenCalled();
    expect(mockUpdateKeyRing).not.toHaveBeenCalled();
    expect(mockSetMasterKey).not.toHaveBeenCalled();
  });

  it("renders section title", () => {
    render(<ChangePassphraseSection />);
    expect(screen.getByText("account.changePassphrase")).toBeInTheDocument();
  });

  it("renders passphrase warning message", () => {
    render(<ChangePassphraseSection />);
    expect(screen.getByText("account.passphraseWarning")).toBeInTheDocument();
  });

  it("renders three password input fields", () => {
    render(<ChangePassphraseSection />);
    expect(screen.getByPlaceholderText("account.currentPassphrase")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.newPassphrase")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.confirmNewPassphrase")).toBeInTheDocument();
  });

  it("renders save button", () => {
    render(<ChangePassphraseSection />);
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  it("disables save button when all fields are empty", () => {
    render(<ChangePassphraseSection />);
    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("disables save button when only current passphrase is filled", async () => {
    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");

    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("disables save button when confirm passphrase is empty", async () => {
    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new-pass");

    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("enables save button when all fields are filled", async () => {
    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new-pass");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "new-pass");

    expect(screen.getByText("common.save")).toBeEnabled();
  });

  it("shows error when new passphrase and confirm do not match", async () => {
    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new-pass");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "different-pass");
    await user.click(screen.getByText("common.save"));

    expect(screen.getByText("account.passphraseMismatch")).toBeInTheDocument();
  });

  it("does not call API when passphrase mismatch", async () => {
    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new-pass");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "different-pass");
    await user.click(screen.getByText("common.save"));

    expect(mockGetEncryptionSalt).not.toHaveBeenCalled();
  });

  it("calls migrated flow and clears fields on success", async () => {
    mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "old-salt" });
    mockDeriveKey.mockImplementation(async (passphrase: string) =>
      passphrase === "new-pass" ? "new-key" : "old-key",
    );
    mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "encrypted-ring" });
    mockDecryptKeyRing.mockResolvedValue({ tree1: "key1" });
    mockGenerateSalt.mockReturnValue("new-salt");
    mockEncryptKeyRing.mockResolvedValue("new-encrypted-ring");
    mockUpdateSalt.mockResolvedValue(undefined);
    mockUpdateKeyRing.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old-pass");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new-pass");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "new-pass");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
    });

    // Fields should be cleared
    expect(screen.getByPlaceholderText("account.currentPassphrase")).toHaveValue("");
    expect(screen.getByPlaceholderText("account.newPassphrase")).toHaveValue("");
    expect(screen.getByPlaceholderText("account.confirmNewPassphrase")).toHaveValue("");

    // Context was updated
    expect(mockSetMasterKey).toHaveBeenCalledWith("new-key");
    expect(mockSetPassphraseHash).toHaveBeenCalledWith("mock-hash");
  });

  it("updates salt before key ring (safety order)", async () => {
    const callOrder: string[] = [];
    mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "old-salt" });
    mockDeriveKey.mockResolvedValue("key");
    mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "ring" });
    mockDecryptKeyRing.mockResolvedValue({});
    mockGenerateSalt.mockReturnValue("new-salt");
    mockEncryptKeyRing.mockResolvedValue("new-ring");
    mockUpdateSalt.mockImplementation(() => {
      callOrder.push("updateSalt");
      return Promise.resolve();
    });
    mockUpdateKeyRing.mockImplementation(() => {
      callOrder.push("updateKeyRing");
      return Promise.resolve();
    });

    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "new");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(callOrder).toEqual(["updateSalt", "updateKeyRing"]);
    });
  });

  it("shows error message when crypto operation fails", async () => {
    mockGetEncryptionSalt.mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "new");
    await user.click(screen.getByText("common.save"));

    await waitFor(() => {
      expect(screen.getByText("account.passphraseError")).toBeInTheDocument();
    });
  });

  it("shows progress indicator during operation", async () => {
    let resolveGetSalt: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveGetSalt = resolve;
    });
    mockGetEncryptionSalt.mockReturnValue(pendingPromise);

    // Configure the downstream operation mocks before resolving so the full
    // re-encryption chain can complete synchronously once unblocked. Without
    // these, the state updates after resolve() happen outside act() and React
    // warns.
    mockDeriveKey.mockResolvedValue("key");
    mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "ring" });
    mockDecryptKeyRing.mockResolvedValue({});
    mockGenerateSalt.mockReturnValue("new-salt");
    mockEncryptKeyRing.mockResolvedValue("new-ring");
    mockUpdateSalt.mockResolvedValue(undefined);
    mockUpdateKeyRing.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<ChangePassphraseSection />);

    await user.type(screen.getByPlaceholderText("account.currentPassphrase"), "old");
    await user.type(screen.getByPlaceholderText("account.newPassphrase"), "new");
    await user.type(screen.getByPlaceholderText("account.confirmNewPassphrase"), "new");
    await user.click(screen.getByText("common.save"));

    expect(screen.getByText("account.reencrypting")).toBeInTheDocument();

    resolveGetSalt!({ encryption_salt: "salt" });

    // Wait for the progress indicator to disappear so all async state updates
    // flush inside act() before the test exits.
    await waitFor(() => {
      expect(screen.queryByText("account.reencrypting")).not.toBeInTheDocument();
    });
  });

  it("all inputs have type password", () => {
    render(<ChangePassphraseSection />);
    const inputs = screen.getAllByPlaceholderText(/account\.(current|new|confirm)/);
    for (const input of inputs) {
      expect(input).toHaveAttribute("type", "password");
    }
  });

  it("inputs have data-1p-ignore attribute to prevent password manager fill", () => {
    render(<ChangePassphraseSection />);
    const inputs = screen.getAllByPlaceholderText(/account\.(current|new|confirm)/);
    for (const input of inputs) {
      expect(input).toHaveAttribute("data-1p-ignore");
    }
  });
});
