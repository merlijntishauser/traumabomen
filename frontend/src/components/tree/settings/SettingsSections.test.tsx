import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePassphraseSection } from "./ChangePassphraseSection";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { DeleteAccountSection } from "./DeleteAccountSection";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../../lib/api", () => ({
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  getEncryptionSalt: vi.fn(),
  getClassifications: vi.fn(),
  getEvents: vi.fn(),
  getJournalEntries: vi.fn(),
  getKeyRing: vi.fn(),
  getLifeEvents: vi.fn(),
  getPatterns: vi.fn(),
  getPersons: vi.fn(),
  getRelationships: vi.fn(),
  getTrees: vi.fn(),
  getTurningPoints: vi.fn(),
  syncTree: vi.fn(),
  updateKeyRing: vi.fn(),
  updateSalt: vi.fn(),
  updateTree: vi.fn(),
}));

vi.mock("../../../lib/crypto", () => ({
  decryptFromApi: vi.fn(),
  decryptKeyRing: vi.fn(),
  deriveKey: vi.fn(),
  encryptForApi: vi.fn(),
  encryptKeyRing: vi.fn(),
  generateSalt: vi.fn(),
  hashPassphrase: () => Promise.resolve("mock-hash"),
}));

const mockSetKey = vi.fn();
const mockSetPassphraseHash = vi.fn();
vi.mock("../../../contexts/useEncryption", () => ({
  useEncryption: () => ({
    isMigrated: true,
    setMasterKey: mockSetKey,
    setPassphraseHash: mockSetPassphraseHash,
  }),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangePasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders password fields and save button", () => {
    render(<ChangePasswordSection />);

    expect(screen.getByPlaceholderText("account.currentPassword")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.newPassword")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.confirmNewPassword")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  it("renders section title", () => {
    render(<ChangePasswordSection />);
    expect(screen.getByText("account.changePassword")).toBeInTheDocument();
  });

  it("disables save button when fields are empty", () => {
    render(<ChangePasswordSection />);
    const saveButton = screen.getByText("common.save");
    expect(saveButton).toBeDisabled();
  });
});

describe("ChangePassphraseSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders passphrase fields and warning", () => {
    render(<ChangePassphraseSection />);

    expect(screen.getByPlaceholderText("account.currentPassphrase")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.newPassphrase")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("account.confirmNewPassphrase")).toBeInTheDocument();
    expect(screen.getByText("account.passphraseWarning")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  it("renders section title", () => {
    render(<ChangePassphraseSection />);
    expect(screen.getByText("account.changePassphrase")).toBeInTheDocument();
  });

  it("disables save button when fields are empty", () => {
    render(<ChangePassphraseSection />);
    const saveButton = screen.getByText("common.save");
    expect(saveButton).toBeDisabled();
  });
});

describe("DeleteAccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders delete button and section title", () => {
    render(<DeleteAccountSection />);

    // Both the section title and the initial button use "account.deleteAccount"
    const elements = screen.getAllByText("account.deleteAccount");
    expect(elements).toHaveLength(2);

    // One is the heading, the other is the button
    const button = elements.find((el) => el.tagName === "BUTTON");
    expect(button).toBeDefined();
  });

  it("does not show confirmation fields initially", () => {
    render(<DeleteAccountSection />);

    expect(screen.queryByPlaceholderText("account.deleteConfirmLabel")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("account.deletePassword")).not.toBeInTheDocument();
  });
});
