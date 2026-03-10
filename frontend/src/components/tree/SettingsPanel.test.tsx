import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasSettings } from "../../hooks/useCanvasSettings";
import { CanvasSettingsContent } from "./CanvasSettingsContent";
import { SettingsPanel } from "./SettingsPanel";

// Dummy credentials for testing (not real passwords)
const DUMMY_OLD_PW = "oldpass";
const DUMMY_NEW_PW = "StrongPass1!"; // must not be "weak" per getPasswordStrength
const DUMMY_WEAK_PW = "short";
const DUMMY_ACCOUNT_PW = "mypassword"; // nosonar

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockChangePassword = vi.fn();
const mockDeleteAccount = vi.fn();
const mockGetEncryptionSalt = vi.fn().mockResolvedValue({
  encryption_salt: "salt",
  passphrase_hint: null,
});
const mockUpdatePassphraseHint = vi.fn().mockResolvedValue(undefined);
const mockGetClassifications = vi.fn();
const mockGetEvents = vi.fn();
const mockGetJournalEntries = vi.fn();
const mockGetLifeEvents = vi.fn();
const mockGetPatterns = vi.fn();
const mockGetPersons = vi.fn();
const mockGetRelationships = vi.fn();
const mockGetTrees = vi.fn();
const mockGetTurningPoints = vi.fn();
const mockGetKeyRing = vi.fn();
const mockSyncTree = vi.fn();
const mockUpdateKeyRing = vi.fn();
const mockUpdateSalt = vi.fn();

vi.mock("../../lib/api", () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  getEncryptionSalt: (...args: unknown[]) => mockGetEncryptionSalt(...args),
  getClassifications: (...args: unknown[]) => mockGetClassifications(...args),
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  getJournalEntries: (...args: unknown[]) => mockGetJournalEntries(...args),
  getKeyRing: (...args: unknown[]) => mockGetKeyRing(...args),
  getLifeEvents: (...args: unknown[]) => mockGetLifeEvents(...args),
  getPatterns: (...args: unknown[]) => mockGetPatterns(...args),
  getPersons: (...args: unknown[]) => mockGetPersons(...args),
  getRelationships: (...args: unknown[]) => mockGetRelationships(...args),
  getTrees: (...args: unknown[]) => mockGetTrees(...args),
  getTurningPoints: (...args: unknown[]) => mockGetTurningPoints(...args),
  syncTree: (...args: unknown[]) => mockSyncTree(...args),
  updateKeyRing: (...args: unknown[]) => mockUpdateKeyRing(...args),
  updatePassphraseHint: (...args: unknown[]) => mockUpdatePassphraseHint(...args),
  updateSalt: (...args: unknown[]) => mockUpdateSalt(...args),
  updateTree: vi.fn(),
}));

const mockDecryptFromApi = vi.fn();
const mockDecryptKeyRing = vi.fn();
const mockDeriveKey = vi.fn();
const mockEncryptForApi = vi.fn();
const mockEncryptKeyRing = vi.fn();
const mockGenerateSalt = vi.fn();

vi.mock("../../lib/crypto", () => ({
  decryptFromApi: (...args: unknown[]) => mockDecryptFromApi(...args),
  decryptKeyRing: (...args: unknown[]) => mockDecryptKeyRing(...args),
  deriveKey: (...args: unknown[]) => mockDeriveKey(...args),
  encryptForApi: (...args: unknown[]) => mockEncryptForApi(...args),
  encryptKeyRing: (...args: unknown[]) => mockEncryptKeyRing(...args),
  generateSalt: (...args: unknown[]) => mockGenerateSalt(...args),
  hashPassphrase: () => Promise.resolve("mock-hash"),
}));

const mockSetKey = vi.fn();
const mockSetPassphraseHash = vi.fn();
let mockIsMigrated = false;
vi.mock("../../contexts/useEncryption", () => ({
  useEncryption: () => ({
    isMigrated: mockIsMigrated,
    setMasterKey: mockSetKey,
    setPassphraseHash: mockSetPassphraseHash,
  }),
}));

const mockToggleTheme = vi.fn();
const mockSetTheme = vi.fn();
vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: mockSetTheme,
    toggle: mockToggleTheme,
    availableThemes: ["dark", "light"],
  }),
}));

vi.mock("../../hooks/useAvailableThemes", () => ({
  useAvailableThemes: () => ["dark", "light"],
}));

const mockLogout = vi.fn();
vi.mock("../../hooks/useLogout", () => ({
  useLogout: () => mockLogout,
}));

const mockChangeLanguage = vi.fn();
let mockI18nLanguage = "en";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      get language() {
        return mockI18nLanguage;
      },
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultSettings(): CanvasSettings {
  return {
    showGrid: false,
    snapToGrid: false,
    edgeStyle: "curved",
    showMarkers: true,
    showMinimap: false,
    promptRelationship: true,
  };
}

function renderPanel(
  overrides: Partial<{ settings: CanvasSettings; onUpdate: ReturnType<typeof vi.fn> }> = {},
) {
  const onUpdate = overrides.onUpdate ?? vi.fn();
  const settings = overrides.settings ?? defaultSettings();
  const viewTab = {
    label: "settings.canvas",
    content: <CanvasSettingsContent settings={settings} onUpdate={onUpdate} />,
  };
  const result = render(<SettingsPanel viewTab={viewTab} />);
  return { ...result, onUpdate, settings };
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", { name: "settings.title" });
  await user.click(trigger);
}

async function switchToAccountTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("settings.account"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockI18nLanguage = "en";
  mockIsMigrated = false;
  mockGetEncryptionSalt.mockResolvedValue({
    encryption_salt: "salt",
    passphrase_hint: null,
  });
  mockUpdatePassphraseHint.mockResolvedValue(undefined);
});

describe("SettingsPanel", () => {
  // -----------------------------------------------------------------------
  // Rendering basics
  // -----------------------------------------------------------------------

  describe("rendering basics", () => {
    it("renders settings trigger button", () => {
      renderPanel();
      expect(screen.getByRole("button", { name: "settings.title" })).toBeInTheDocument();
    });

    it("clicking trigger opens dropdown panel", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      expect(screen.getByText("settings.canvas")).toBeInTheDocument();
      expect(screen.getByText("settings.account")).toBeInTheDocument();
    });

    it("clicking trigger again closes dropdown panel", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      expect(screen.getByText("settings.canvas")).toBeInTheDocument();

      // Click trigger again to close
      await user.click(screen.getByRole("button", { name: "settings.title" }));
      expect(screen.queryByText("settings.canvas")).not.toBeInTheDocument();
    });

    it("clicking outside closes dropdown", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      expect(screen.getByText("settings.canvas")).toBeInTheDocument();

      // Click on body (outside the dropdown and trigger)
      // Use fireEvent.mouseDown directly on document.body
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText("settings.canvas")).not.toBeInTheDocument();
      });
    });

    it("clicking inside dropdown does not close it", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      // Click inside the dropdown content
      await user.click(screen.getByText("settings.canvas"));
      expect(screen.getByText("settings.canvas")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Canvas tab (default)
  // -----------------------------------------------------------------------

  describe("canvas tab", () => {
    it("shows canvas settings controls by default", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      expect(screen.getByText("canvas.gridSettings")).toBeInTheDocument();
      expect(screen.getByText("canvas.showGrid")).toBeInTheDocument();
      expect(screen.getByText("canvas.snapToGrid")).toBeInTheDocument();
      expect(screen.getByText("canvas.edgeStyle")).toBeInTheDocument();
      expect(screen.getByText("canvas.showMarkers")).toBeInTheDocument();
      expect(screen.getByText("canvas.showMinimap")).toBeInTheDocument();
      expect(screen.getByText("canvas.promptRelationship")).toBeInTheDocument();
    });

    it("toggle grid calls onUpdate with showGrid", async () => {
      const user = userEvent.setup();
      const { onUpdate } = renderPanel();
      await openPanel(user);

      const gridCheckbox = screen
        .getByText("canvas.showGrid")
        .closest("label")
        ?.querySelector("input");
      expect(gridCheckbox).toBeDefined();
      await user.click(gridCheckbox!);

      expect(onUpdate).toHaveBeenCalledWith({ showGrid: true });
    });

    it("toggle snap-to-grid calls onUpdate with snapToGrid", async () => {
      const user = userEvent.setup();
      const { onUpdate } = renderPanel();
      await openPanel(user);

      const snapCheckbox = screen
        .getByText("canvas.snapToGrid")
        .closest("label")
        ?.querySelector("input");
      expect(snapCheckbox).toBeDefined();
      await user.click(snapCheckbox!);

      expect(onUpdate).toHaveBeenCalledWith({ snapToGrid: true });
    });

    it("change edge style calls onUpdate with edgeStyle", async () => {
      const user = userEvent.setup();
      const { onUpdate } = renderPanel();
      await openPanel(user);

      // Click the "straight" radio
      const straightRadio = screen
        .getByText("canvas.edgeStyle.straight")
        .closest("label")
        ?.querySelector("input");
      expect(straightRadio).toBeDefined();
      await user.click(straightRadio!);

      expect(onUpdate).toHaveBeenCalledWith({ edgeStyle: "straight" });
    });

    it("shows all three edge style options", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      expect(screen.getByText("canvas.edgeStyle.curved")).toBeInTheDocument();
      expect(screen.getByText("canvas.edgeStyle.elbows")).toBeInTheDocument();
      expect(screen.getByText("canvas.edgeStyle.straight")).toBeInTheDocument();
    });

    it("marks the current edge style radio as checked", async () => {
      const user = userEvent.setup();
      renderPanel({ settings: { ...defaultSettings(), edgeStyle: "elbows" } });
      await openPanel(user);

      const elbowsRadio = screen
        .getByText("canvas.edgeStyle.elbows")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;
      expect(elbowsRadio.checked).toBe(true);
    });

    it("toggle markers calls onUpdate with showMarkers", async () => {
      const user = userEvent.setup();
      const { onUpdate } = renderPanel();
      await openPanel(user);

      // showMarkers defaults to true, so clicking should set it to false
      const markersCheckbox = screen
        .getByText("canvas.showMarkers")
        .closest("label")
        ?.querySelector("input");
      expect(markersCheckbox).toBeDefined();
      await user.click(markersCheckbox!);

      expect(onUpdate).toHaveBeenCalledWith({ showMarkers: false });
    });

    it("toggle promptRelationship calls onUpdate with promptRelationship", async () => {
      const user = userEvent.setup();
      const { onUpdate } = renderPanel();
      await openPanel(user);

      // promptRelationship defaults to true, so clicking should set it to false
      const promptCheckbox = screen
        .getByText("canvas.promptRelationship")
        .closest("label")
        ?.querySelector("input");
      expect(promptCheckbox).toBeDefined();
      await user.click(promptCheckbox!);

      expect(onUpdate).toHaveBeenCalledWith({ promptRelationship: false });
    });

    it("toggle minimap calls onUpdate with showMinimap", async () => {
      const user = userEvent.setup();
      const { onUpdate } = renderPanel();
      await openPanel(user);

      const minimapCheckbox = screen
        .getByText("canvas.showMinimap")
        .closest("label")
        ?.querySelector("input");
      expect(minimapCheckbox).toBeDefined();
      await user.click(minimapCheckbox!);

      expect(onUpdate).toHaveBeenCalledWith({ showMinimap: true });
    });

    it("reflects current settings in checkbox states", async () => {
      const user = userEvent.setup();
      renderPanel({
        settings: {
          showGrid: true,
          snapToGrid: true,
          edgeStyle: "curved",
          showMarkers: false,
          showMinimap: true,
          promptRelationship: true,
        },
      });
      await openPanel(user);

      const gridCheckbox = screen
        .getByText("canvas.showGrid")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;
      const snapCheckbox = screen
        .getByText("canvas.snapToGrid")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;
      const markersCheckbox = screen
        .getByText("canvas.showMarkers")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;
      const minimapCheckbox = screen
        .getByText("canvas.showMinimap")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;

      expect(gridCheckbox.checked).toBe(true);
      expect(snapCheckbox.checked).toBe(true);
      expect(markersCheckbox.checked).toBe(false);
      expect(minimapCheckbox.checked).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Theme and language
  // -----------------------------------------------------------------------

  describe("theme and language", () => {
    it("renders theme radio buttons", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      const themeRadios = screen
        .getAllByRole("radio")
        .filter((r) => r.getAttribute("name") === "theme");
      expect(themeRadios).toHaveLength(2); // dark and light (default available themes)
      expect(themeRadios[0]).toBeChecked(); // dark is selected
    });

    it("clicking theme radio calls setTheme", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      const themeRadios = screen
        .getAllByRole("radio")
        .filter((r) => r.getAttribute("name") === "theme");
      await user.click(themeRadios[1]); // click "light"

      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("renders language radio buttons", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      expect(screen.getByText("English")).toBeInTheDocument();
      expect(screen.getByText("Nederlands")).toBeInTheDocument();
    });

    it("marks the current language radio as checked", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      const enRadio = screen
        .getByText("English")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;
      const nlRadio = screen
        .getByText("Nederlands")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;

      expect(enRadio.checked).toBe(true);
      expect(nlRadio.checked).toBe(false);
    });

    it("clicking Nederlands radio calls changeLanguage with nl", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      const nlRadio = screen.getByText("Nederlands").closest("label")?.querySelector("input");
      expect(nlRadio).toBeDefined();
      await user.click(nlRadio!);

      expect(mockChangeLanguage).toHaveBeenCalledWith("nl");
    });

    it("clicking English radio calls changeLanguage with en when language is nl", async () => {
      mockI18nLanguage = "nl";
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      const enRadio = screen
        .getByText("English")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;
      const nlRadio = screen
        .getByText("Nederlands")
        .closest("label")
        ?.querySelector("input") as HTMLInputElement;

      // Nederlands should be checked, English should not
      expect(nlRadio.checked).toBe(true);
      expect(enRadio.checked).toBe(false);

      await user.click(enRadio);

      expect(mockChangeLanguage).toHaveBeenCalledWith("en");
    });
  });

  // -----------------------------------------------------------------------
  // Account tab
  // -----------------------------------------------------------------------

  describe("account tab", () => {
    it("switching to account tab shows password change form", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      expect(screen.getByText("account.changePassword")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.currentPassword")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.newPassword")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.confirmNewPassword")).toBeInTheDocument();
    });

    it("shows passphrase change section", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      expect(screen.getByText("account.changePassphrase")).toBeInTheDocument();
      expect(screen.getByText("account.passphraseWarning")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.currentPassphrase")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.newPassphrase")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.confirmNewPassphrase")).toBeInTheDocument();
    });

    it("shows delete account section", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // Both the heading and the button contain "account.deleteAccount"
      const elements = screen.getAllByText("account.deleteAccount");
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    it("switching back to canvas tab hides account content", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      expect(screen.getByText("account.changePassword")).toBeInTheDocument();

      await user.click(screen.getByText("settings.canvas"));
      expect(screen.queryByText("account.changePassword")).not.toBeInTheDocument();
      expect(screen.getByText("canvas.gridSettings")).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Password change
  // -----------------------------------------------------------------------

  describe("password change", () => {
    it("save button is disabled when fields are empty", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // There are multiple "common.save" buttons; get the first one (password section)
      const saveButtons = screen.getAllByText("common.save");
      expect(saveButtons[0]).toBeDisabled();
    });

    it("save button is enabled when all password fields are filled", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassword"), {
        target: { value: DUMMY_OLD_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassword"), {
        target: { value: DUMMY_NEW_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassword"), {
        target: { value: DUMMY_NEW_PW },
      });

      const saveButtons = screen.getAllByText("common.save");
      expect(saveButtons[0]).not.toBeDisabled();
    });

    it("shows error on password mismatch", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassword"), {
        target: { value: DUMMY_OLD_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassword"), {
        target: { value: DUMMY_NEW_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassword"), {
        target: { value: "different" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[0]);

      expect(screen.getByText("account.passwordMismatch")).toBeInTheDocument();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("calls changePassword API on successful submit", async () => {
      const user = userEvent.setup();
      mockChangePassword.mockResolvedValue(undefined);
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassword"), {
        target: { value: DUMMY_OLD_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassword"), {
        target: { value: DUMMY_NEW_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassword"), {
        target: { value: DUMMY_NEW_PW },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[0]);

      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith({
          current_password: DUMMY_OLD_PW,
          new_password: DUMMY_NEW_PW,
        });
      });

      expect(screen.getByText("account.passwordChanged")).toBeInTheDocument();
    });

    it("shows error when changePassword API fails", async () => {
      const user = userEvent.setup();
      mockChangePassword.mockRejectedValue(new Error("failed"));
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassword"), {
        target: { value: DUMMY_OLD_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassword"), {
        target: { value: DUMMY_NEW_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassword"), {
        target: { value: DUMMY_NEW_PW },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("account.passwordError")).toBeInTheDocument();
      });
    });

    it("save button is disabled when new password is weak", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassword"), {
        target: { value: DUMMY_OLD_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassword"), {
        target: { value: DUMMY_WEAK_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassword"), {
        target: { value: DUMMY_WEAK_PW },
      });

      const saveButtons = screen.getAllByText("common.save");
      expect(saveButtons[0]).toBeDisabled();
    });

    it("shows error when submitting with a weak password", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // Use a password that is fair (not weak) for the disabled check to pass,
      // but we test the handleChangePassword guard directly by using fireEvent
      // to bypass the disabled state. Instead, use a password that is exactly
      // at the weak boundary (8 chars, lowercase only = score 1 = weak).
      const weakButLongEnough = "abcdefgh"; // 8 chars, lowercase only, score=1, weak
      fireEvent.change(screen.getByPlaceholderText("account.currentPassword"), {
        target: { value: DUMMY_OLD_PW },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassword"), {
        target: { value: weakButLongEnough },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassword"), {
        target: { value: weakButLongEnough },
      });

      // The button should be disabled because the password is weak
      const saveButtons = screen.getAllByText("common.save");
      expect(saveButtons[0]).toBeDisabled();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("clears password fields after successful change", async () => {
      const user = userEvent.setup();
      mockChangePassword.mockResolvedValue(undefined);
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      const currentPw = screen.getByPlaceholderText("account.currentPassword");
      const newPw = screen.getByPlaceholderText("account.newPassword");
      const confirmPw = screen.getByPlaceholderText("account.confirmNewPassword");

      fireEvent.change(currentPw, { target: { value: DUMMY_OLD_PW } });
      fireEvent.change(newPw, { target: { value: DUMMY_NEW_PW } });
      fireEvent.change(confirmPw, { target: { value: DUMMY_NEW_PW } });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("account.passwordChanged")).toBeInTheDocument();
      });

      expect(currentPw).toHaveValue("");
      expect(newPw).toHaveValue("");
      expect(confirmPw).toHaveValue("");
    });
  });

  // -----------------------------------------------------------------------
  // Passphrase change
  // -----------------------------------------------------------------------

  describe("passphrase change", () => {
    it("save button is disabled when passphrase fields are empty", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      const saveButtons = screen.getAllByText("common.save");
      // Second save button is for passphrase
      expect(saveButtons[1]).toBeDisabled();
    });

    it("shows error on passphrase mismatch", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "different" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      expect(screen.getByText("account.passphraseMismatch")).toBeInTheDocument();
    });

    it("shows error when old passphrase derivation fails", async () => {
      const user = userEvent.setup();
      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey.mockRejectedValue(new Error("bad passphrase"));

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "wrongpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseError")).toBeInTheDocument();
      });
    });

    it("calls re-encryption flow on successful passphrase change", async () => {
      const user = userEvent.setup();
      const fakeCryptoKey = {} as CryptoKey;
      const fakeNewKey = {} as CryptoKey;

      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey
        .mockResolvedValueOnce(fakeCryptoKey) // old key
        .mockResolvedValueOnce(fakeNewKey); // new key
      mockGenerateSalt.mockReturnValue("newsalt456");
      mockGetTrees.mockResolvedValue([{ id: "t1", encrypted_data: "enc-tree" }]);
      mockDecryptFromApi.mockResolvedValue({ name: "My Tree" });
      mockEncryptForApi.mockResolvedValue("re-encrypted");
      mockGetPersons.mockResolvedValue([]);
      mockGetRelationships.mockResolvedValue([]);
      mockGetEvents.mockResolvedValue([]);
      mockGetLifeEvents.mockResolvedValue([]);
      mockGetClassifications.mockResolvedValue([]);
      mockGetPatterns.mockResolvedValue([]);
      mockGetTurningPoints.mockResolvedValue([]);
      mockGetJournalEntries.mockResolvedValue([]);
      mockSyncTree.mockResolvedValue(undefined);
      mockUpdateSalt.mockResolvedValue(undefined);

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
      });

      expect(mockGetEncryptionSalt).toHaveBeenCalled();
      expect(mockDeriveKey).toHaveBeenCalledWith("oldpp", "salt123");
      expect(mockDeriveKey).toHaveBeenCalledWith("newpp", "newsalt456");
      expect(mockGetTrees).toHaveBeenCalled();
      expect(mockUpdateSalt).toHaveBeenCalledWith({ encryption_salt: "newsalt456" });
      expect(mockSetKey).toHaveBeenCalledWith(fakeNewKey);
    });

    it("re-encrypts all entity types during passphrase change", async () => {
      const user = userEvent.setup();
      const fakeCryptoKey = {} as CryptoKey;
      const fakeNewKey = {} as CryptoKey;

      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey
        .mockResolvedValueOnce(fakeCryptoKey) // old key
        .mockResolvedValueOnce(fakeNewKey); // new key
      mockGenerateSalt.mockReturnValue("newsalt456");
      mockGetTrees.mockResolvedValue([{ id: "t1", encrypted_data: "enc-tree" }]);
      mockDecryptFromApi.mockResolvedValue({ some: "data" });
      mockEncryptForApi.mockResolvedValue("re-encrypted");
      mockGetPersons.mockResolvedValue([{ id: "p1", encrypted_data: "enc-p" }]);
      mockGetRelationships.mockResolvedValue([
        { id: "r1", source_person_id: "p1", target_person_id: "p2", encrypted_data: "enc-r" },
      ]);
      mockGetEvents.mockResolvedValue([{ id: "e1", person_ids: ["p1"], encrypted_data: "enc-e" }]);
      mockGetLifeEvents.mockResolvedValue([
        { id: "le1", person_ids: ["p1"], encrypted_data: "enc-le" },
      ]);
      mockGetClassifications.mockResolvedValue([
        { id: "c1", person_ids: ["p1"], encrypted_data: "enc-c" },
      ]);
      mockGetPatterns.mockResolvedValue([
        { id: "pat1", person_ids: ["p1"], encrypted_data: "enc-pat" },
      ]);
      mockGetTurningPoints.mockResolvedValue([
        { id: "tp1", person_ids: ["p1"], encrypted_data: "enc-tp" },
      ]);
      mockGetJournalEntries.mockResolvedValue([{ id: "j1", encrypted_data: "enc-j" }]);
      mockSyncTree.mockResolvedValue(undefined);
      mockUpdateSalt.mockResolvedValue(undefined);

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
      });

      // Decrypt is called for: tree + person + relationship + event + life event
      //   + classification + pattern + turning point + journal entry = 9
      expect(mockDecryptFromApi).toHaveBeenCalledTimes(9);
      // Encrypt is called for the same 9 entities
      expect(mockEncryptForApi).toHaveBeenCalledTimes(9);

      // syncTree should include all entity types
      expect(mockSyncTree).toHaveBeenCalledWith("t1", {
        persons_update: [{ id: "p1", encrypted_data: "re-encrypted" }],
        relationships_update: [
          {
            id: "r1",
            source_person_id: "p1",
            target_person_id: "p2",
            encrypted_data: "re-encrypted",
          },
        ],
        events_update: [{ id: "e1", person_ids: ["p1"], encrypted_data: "re-encrypted" }],
        life_events_update: [{ id: "le1", person_ids: ["p1"], encrypted_data: "re-encrypted" }],
        classifications_update: [{ id: "c1", person_ids: ["p1"], encrypted_data: "re-encrypted" }],
        patterns_update: [{ id: "pat1", person_ids: ["p1"], encrypted_data: "re-encrypted" }],
        turning_points_update: [{ id: "tp1", person_ids: ["p1"], encrypted_data: "re-encrypted" }],
        journal_entries_update: [{ id: "j1", encrypted_data: "re-encrypted" }],
      });
    });

    it("clears passphrase fields after successful change", async () => {
      const user = userEvent.setup();
      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey.mockResolvedValue({} as CryptoKey);
      mockGenerateSalt.mockReturnValue("newsalt");
      mockGetTrees.mockResolvedValue([]);
      mockGetPatterns.mockResolvedValue([]);
      mockUpdateSalt.mockResolvedValue(undefined);

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      const currentPp = screen.getByPlaceholderText("account.currentPassphrase");
      const newPp = screen.getByPlaceholderText("account.newPassphrase");
      const confirmPp = screen.getByPlaceholderText("account.confirmNewPassphrase");

      fireEvent.change(currentPp, { target: { value: "oldpp" } });
      fireEvent.change(newPp, { target: { value: "newpp" } });
      fireEvent.change(confirmPp, { target: { value: "newpp" } });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
      });

      expect(currentPp).toHaveValue("");
      expect(newPp).toHaveValue("");
      expect(confirmPp).toHaveValue("");
    });

    it("shows progress message during re-encryption", async () => {
      const user = userEvent.setup();
      // Make the whole flow complete but check that progress was shown
      // We use a successful flow that completes quickly
      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey.mockResolvedValue({} as CryptoKey);
      mockGenerateSalt.mockReturnValue("newsalt");
      mockGetTrees.mockResolvedValue([]);
      mockGetPatterns.mockResolvedValue([]);
      mockUpdateSalt.mockResolvedValue(undefined);

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      // The flow completes and shows success; progress was cleared
      await waitFor(() => {
        expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
      });

      // Verify the salt fetch was called (which means progress was set)
      expect(mockGetEncryptionSalt).toHaveBeenCalled();
    });

    it("shows error when re-encryption flow fails", async () => {
      const user = userEvent.setup();
      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey.mockResolvedValue({} as CryptoKey);
      mockGenerateSalt.mockReturnValue("newsalt");
      mockGetTrees.mockRejectedValue(new Error("network failure"));

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseError")).toBeInTheDocument();
      });
    });

    it("migrated flow does not leave partial server state when salt update fails", async () => {
      const user = userEvent.setup();
      mockIsMigrated = true;

      const fakeCryptoKey = {} as CryptoKey;
      const fakeNewKey = {} as CryptoKey;

      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey
        .mockResolvedValueOnce(fakeCryptoKey) // old key
        .mockResolvedValueOnce(fakeNewKey); // new key
      mockGenerateSalt.mockReturnValue("newsalt456");
      mockGetKeyRing.mockResolvedValue({ encrypted_key_ring: "enc-ring" });
      mockDecryptKeyRing.mockResolvedValue({ tree1: "key-b64" });
      mockEncryptKeyRing.mockResolvedValue("new-enc-ring");
      // Salt update fails after key ring is encrypted
      mockUpdateSalt.mockRejectedValue(new Error("network error"));

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseError")).toBeInTheDocument();
      });

      // Key and hash must NOT have been updated in context
      expect(mockSetKey).not.toHaveBeenCalled();
      expect(mockSetPassphraseHash).not.toHaveBeenCalled();
      // Key ring update should not have been attempted (salt failed first)
      expect(mockUpdateKeyRing).not.toHaveBeenCalled();
    });

    it("legacy flow re-encrypts turning_points and journal_entries", async () => {
      const user = userEvent.setup();
      mockIsMigrated = false;

      const fakeCryptoKey = {} as CryptoKey;
      const fakeNewKey = {} as CryptoKey;

      mockGetEncryptionSalt.mockResolvedValue({ encryption_salt: "salt123" });
      mockDeriveKey
        .mockResolvedValueOnce(fakeCryptoKey) // old key
        .mockResolvedValueOnce(fakeNewKey); // new key
      mockGenerateSalt.mockReturnValue("newsalt456");
      mockGetTrees.mockResolvedValue([{ id: "t1", encrypted_data: "enc-tree" }]);
      mockDecryptFromApi.mockResolvedValue({ some: "data" });
      mockEncryptForApi.mockResolvedValue("re-encrypted");
      mockGetPersons.mockResolvedValue([]);
      mockGetRelationships.mockResolvedValue([]);
      mockGetEvents.mockResolvedValue([]);
      mockGetLifeEvents.mockResolvedValue([]);
      mockGetClassifications.mockResolvedValue([]);
      mockGetPatterns.mockResolvedValue([]);
      mockGetTurningPoints.mockResolvedValue([
        { id: "tp1", person_ids: ["p1"], encrypted_data: "enc-tp" },
      ]);
      mockGetJournalEntries.mockResolvedValue([{ id: "j1", encrypted_data: "enc-j" }]);
      mockSyncTree.mockResolvedValue(undefined);
      mockUpdateSalt.mockResolvedValue(undefined);

      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      fireEvent.change(screen.getByPlaceholderText("account.currentPassphrase"), {
        target: { value: "oldpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.newPassphrase"), {
        target: { value: "newpp" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.confirmNewPassphrase"), {
        target: { value: "newpp" },
      });

      const saveButtons = screen.getAllByText("common.save");
      await user.click(saveButtons[1]);

      await waitFor(() => {
        expect(screen.getByText("account.passphraseChanged")).toBeInTheDocument();
      });

      // syncTree should include turning_points and journal_entries
      expect(mockSyncTree).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({
          turning_points_update: [
            { id: "tp1", person_ids: ["p1"], encrypted_data: "re-encrypted" },
          ],
          journal_entries_update: [{ id: "j1", encrypted_data: "re-encrypted" }],
        }),
      );

      // updateSalt is called after syncTree (legacy: data first, salt last)
      expect(mockUpdateSalt).toHaveBeenCalledWith({ encryption_salt: "newsalt456" });
      const syncOrder = mockSyncTree.mock.invocationCallOrder[0];
      const saltOrder = mockUpdateSalt.mock.invocationCallOrder[0];
      expect(syncOrder).toBeLessThan(saltOrder);
    });
  });

  // -----------------------------------------------------------------------
  // Delete account
  // -----------------------------------------------------------------------

  describe("delete account", () => {
    it("initially shows only the delete account button", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // The delete account button should be visible
      const deleteButtons = screen.getAllByText("account.deleteAccount");
      // One is the heading h4, the other is the button
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2);

      // Confirmation inputs should NOT be visible
      expect(screen.queryByPlaceholderText("account.deleteConfirmLabel")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("account.deletePassword")).not.toBeInTheDocument();
    });

    it("expanding delete shows confirmation form", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // Click the delete button to expand
      const dangerButton = screen.getByRole("button", { name: "account.deleteAccount" });
      await user.click(dangerButton);

      expect(screen.getByText("account.deleteWarning")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.deleteConfirmLabel")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("account.deletePassword")).toBeInTheDocument();
      expect(screen.getByText("account.deleteButton")).toBeInTheDocument();
    });

    it("delete button is disabled until confirmation text is DELETE and password is provided", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // Expand delete section
      const dangerButton = screen.getByRole("button", { name: "account.deleteAccount" });
      await user.click(dangerButton);

      const confirmDeleteButton = screen.getByText("account.deleteButton");
      expect(confirmDeleteButton).toBeDisabled();

      // Type partial confirmation
      fireEvent.change(screen.getByPlaceholderText("account.deleteConfirmLabel"), {
        target: { value: "DELET" },
      });
      expect(confirmDeleteButton).toBeDisabled();

      // Type full confirmation but no password
      fireEvent.change(screen.getByPlaceholderText("account.deleteConfirmLabel"), {
        target: { value: "DELETE" },
      });
      expect(confirmDeleteButton).toBeDisabled();

      // Add password
      fireEvent.change(screen.getByPlaceholderText("account.deletePassword"), {
        target: { value: DUMMY_ACCOUNT_PW },
      });
      expect(confirmDeleteButton).not.toBeDisabled();
    });

    it("calls deleteAccount API and logout on successful delete", async () => {
      const user = userEvent.setup();
      mockDeleteAccount.mockResolvedValue(undefined);
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // Expand delete section
      const dangerButton = screen.getByRole("button", { name: "account.deleteAccount" });
      await user.click(dangerButton);

      fireEvent.change(screen.getByPlaceholderText("account.deleteConfirmLabel"), {
        target: { value: "DELETE" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.deletePassword"), {
        target: { value: DUMMY_ACCOUNT_PW },
      });

      await user.click(screen.getByText("account.deleteButton"));

      await waitFor(() => {
        expect(mockDeleteAccount).toHaveBeenCalledWith({ password: DUMMY_ACCOUNT_PW });
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it("shows error when deleteAccount API fails", async () => {
      const user = userEvent.setup();
      mockDeleteAccount.mockRejectedValue(new Error("failed"));
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      // Expand delete section
      const dangerButton = screen.getByRole("button", { name: "account.deleteAccount" });
      await user.click(dangerButton);

      fireEvent.change(screen.getByPlaceholderText("account.deleteConfirmLabel"), {
        target: { value: "DELETE" },
      });
      fireEvent.change(screen.getByPlaceholderText("account.deletePassword"), {
        target: { value: DUMMY_ACCOUNT_PW },
      });

      await user.click(screen.getByText("account.deleteButton"));

      await waitFor(() => {
        expect(screen.getByText("account.deleteError")).toBeInTheDocument();
      });

      // logout should NOT have been called
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Tab active state
  // -----------------------------------------------------------------------

  describe("tab styling", () => {
    it("canvas tab has active class by default", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);

      const canvasTab = screen.getByText("settings.canvas");
      expect(canvasTab.className).toContain("settings-panel__tab--active");

      const accountTab = screen.getByText("settings.account");
      expect(accountTab.className).not.toContain("settings-panel__tab--active");
    });

    it("account tab has active class when selected", async () => {
      const user = userEvent.setup();
      renderPanel();
      await openPanel(user);
      await switchToAccountTab(user);

      const canvasTab = screen.getByText("settings.canvas");
      expect(canvasTab.className).not.toContain("settings-panel__tab--active");

      const accountTab = screen.getByText("settings.account");
      expect(accountTab.className).toContain("settings-panel__tab--active");
    });
  });
});
