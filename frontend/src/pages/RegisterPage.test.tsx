import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "./RegisterPage";

/* eslint-disable sonarjs/no-hardcoded-passwords */
const VALID_PW = "StrongPass1!";
const MISMATCHED_PW = "DifferentPass1!";
const SHORT_PASSPHRASE = "short";
const MISMATCHED_PASSPHRASE = "different-passphrase";
const VALID_PASSPHRASE = "my-passphrase-12";
/* eslint-enable sonarjs/no-hardcoded-passwords */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("../components/AuthHero", () => ({
  AuthHero: () => <div data-testid="auth-hero" />,
}));

vi.mock("../components/PasswordStrengthMeter", () => ({
  PasswordStrengthMeter: ({ password }: { password: string }) => (
    <div data-testid="password-strength">{password ? "meter" : ""}</div>
  ),
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
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockRegister = vi.fn();
vi.mock("../lib/api", () => ({
  register: (...args: unknown[]) => mockRegister(...args),
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
const mockGenerateSalt = vi.fn();
const mockHashPassphrase = vi.fn();
vi.mock("../lib/crypto", () => ({
  deriveKey: (...args: unknown[]) => mockDeriveKey(...args),
  generateSalt: () => mockGenerateSalt(),
  hashPassphrase: (...args: unknown[]) => mockHashPassphrase(...args),
}));

const mockLoadOrMigrateKeyRing = vi.fn();
vi.mock("../lib/keyRingLoader", () => ({
  loadOrMigrateKeyRing: (...args: unknown[]) => mockLoadOrMigrateKeyRing(...args),
}));

// Password strength mock: control behavior based on input
vi.mock("../lib/passwordStrength", () => ({
  getPasswordStrength: (password: string) => {
    if (password.length < 8) return { score: 0, level: "weak" };
    if (password.length < 12) return { score: 3, level: "fair" };
    return { score: 5, level: "strong" };
  },
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateSalt.mockReturnValue("test-salt-base64");
    mockDeriveKey.mockResolvedValue({} as CryptoKey);
    mockHashPassphrase.mockResolvedValue("hashed-passphrase");
    mockLoadOrMigrateKeyRing.mockResolvedValue({
      keys: new Map(),
      base64Map: new Map(),
    });
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
  }

  // -- Step 1: Account --

  it("renders the account step with email, password, and confirm fields", () => {
    renderPage();
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.password")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.confirmPassword")).toBeInTheDocument();
    // Passphrase fields should not be visible yet
    expect(screen.queryByLabelText("auth.passphrase")).not.toBeInTheDocument();
  });

  it("renders the AuthHero component", () => {
    renderPage();
    expect(screen.getByTestId("auth-hero")).toBeInTheDocument();
  });

  it("renders password strength meter", () => {
    renderPage();
    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
  });

  it("renders step indicator with labels", () => {
    renderPage();
    const steps = screen.getByRole("navigation", { name: "auth.stepProgress" });
    expect(steps).toBeInTheDocument();
    expect(steps.querySelectorAll(".auth-steps__item")).toHaveLength(3);
    expect(screen.getByText("auth.stepLabel.account")).toBeInTheDocument();
    expect(screen.getByText("auth.stepLabel.encryption")).toBeInTheDocument();
    expect(screen.getByText("auth.stepLabel.confirm")).toBeInTheDocument();
  });

  it("renders a link to login page", () => {
    renderPage();
    expect(screen.getByText("auth.login")).toBeInTheDocument();
  });

  it("renders a link to privacy policy", () => {
    renderPage();
    expect(screen.getByText("landing.readPrivacyPolicy")).toBeInTheDocument();
  });

  it("continue button shows next label", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: "auth.stepNext" });
    expect(btn).toBeInTheDocument();
  });

  // -- Step 1 validation: weak password --

  it("disables continue button when password is weak", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: "short" },
    });
    const btn = screen.getByRole("button", { name: "auth.stepNext" });
    expect(btn).toBeDisabled();
  });

  it("shows hint explaining why button is disabled when password is weak", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: "short" },
    });
    expect(screen.getByText("auth.passwordWeakHint")).toBeInTheDocument();
  });

  it("does not show weak password hint when password is empty", () => {
    renderPage();
    expect(screen.queryByText("auth.passwordWeakHint")).not.toBeInTheDocument();
  });

  it("does not show weak password hint when password is strong", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: VALID_PW },
    });
    expect(screen.queryByText("auth.passwordWeakHint")).not.toBeInTheDocument();
  });

  it("enables continue button when password is not weak", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: VALID_PW },
    });
    const btn = screen.getByRole("button", { name: "auth.stepNext" });
    expect(btn).not.toBeDisabled();
  });

  // -- Step 1 validation: password too long --

  it("shows error when password exceeds 64 characters", async () => {
    renderPage();
    const longPassword = "A".repeat(65);
    fillAccountStep({ password: longPassword, confirmPassword: longPassword });
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passwordTooLong");
    });
  });

  // -- Step 1 validation: password mismatch --

  it("shows error when passwords do not match", async () => {
    renderPage();
    fillAccountStep({ confirmPassword: MISMATCHED_PW });
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passwordMismatch");
    });
  });

  // -- Step 2: Encryption --

  it("advances to encryption step after valid account step", () => {
    renderPage();
    fillAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.confirmPassphrase")).toBeInTheDocument();
    expect(screen.getByText("auth.stepTitle.encryption")).toBeInTheDocument();
  });

  it("shows hint field on encryption step", () => {
    renderPage();
    advanceToEncryptionStep();
    expect(screen.getByLabelText("auth.hintFieldLabel")).toBeInTheDocument();
  });

  it("shows back button on encryption step", () => {
    renderPage();
    advanceToEncryptionStep();
    expect(screen.getByRole("button", { name: "auth.stepBack" })).toBeInTheDocument();
  });

  it("back button returns to account step", () => {
    renderPage();
    advanceToEncryptionStep();
    fireEvent.click(screen.getByRole("button", { name: "auth.stepBack" }));
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
  });

  // -- Step 2 validation: passphrase too short --

  it("shows error when passphrase is shorter than 8 characters", async () => {
    renderPage();
    advanceToEncryptionStep();
    fillEncryptionStep({ passphrase: SHORT_PASSPHRASE, confirmPassphrase: SHORT_PASSPHRASE });
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseTooShort");
    });
  });

  // -- Step 2 validation: passphrase mismatch --

  it("shows error when passphrases do not match", async () => {
    renderPage();
    advanceToEncryptionStep();
    fillEncryptionStep({ confirmPassphrase: MISMATCHED_PASSPHRASE });
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseMismatch");
    });
  });

  // -- Step 3: Confirm --

  it("advances to confirm step with warning and checkbox", () => {
    renderPage();
    advanceToConfirmStep();
    expect(screen.getByText("auth.passphraseWarning")).toBeInTheDocument();
    expect(screen.getByText("auth.acknowledgeWarning")).toBeInTheDocument();
  });

  it("disables submit when acknowledgment checkbox is not checked", () => {
    renderPage();
    advanceToConfirmStep();
    const btn = screen.getByRole("button", { name: "auth.register" });
    expect(btn).toBeDisabled();
  });

  it("enables submit when acknowledgment checkbox is checked", () => {
    renderPage();
    advanceToConfirmStep();
    fireEvent.click(screen.getByRole("checkbox"));
    const btn = screen.getByRole("button", { name: "auth.register" });
    expect(btn).not.toBeDisabled();
  });

  // -- Successful registration with verification flow --

  it("navigates to verify-pending when verification email is sent", async () => {
    mockRegister.mockResolvedValue({ message: "verification_email_sent" });
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          password: VALID_PW,
          encryption_salt: "test-salt-base64",
          language: "en",
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith("/verify-pending", {
        state: { email: "test@example.com" },
      });
    });
  });

  it("does not derive key when verification email flow is used", async () => {
    mockRegister.mockResolvedValue({ message: "verification_email_sent" });
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/verify-pending", expect.anything());
    });
    expect(mockDeriveKey).not.toHaveBeenCalled();
    expect(mockSetMasterKey).not.toHaveBeenCalled();
  });

  // -- Successful registration with immediate login --

  it("derives key and navigates to trees on immediate login response", async () => {
    mockRegister.mockResolvedValue({
      access_token: "token",
      refresh_token: "refresh",
      token_type: "bearer",
    });
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(mockDeriveKey).toHaveBeenCalledWith(VALID_PASSPHRASE, "test-salt-base64");
      expect(mockHashPassphrase).toHaveBeenCalledWith(VALID_PASSPHRASE);
      expect(mockSetMasterKey).toHaveBeenCalled();
      expect(mockSetPassphraseHash).toHaveBeenCalledWith("hashed-passphrase");
      expect(mockLoadOrMigrateKeyRing).toHaveBeenCalled();
      expect(mockSetTreeKeys).toHaveBeenCalled();
      expect(mockSetKeyRingBase64).toHaveBeenCalled();
      expect(mockSetIsMigrated).toHaveBeenCalledWith(true);
      expect(mockNavigate).toHaveBeenCalledWith("/trees");
    });
  });

  // -- Error: registration closed (403) --

  it("redirects to waitlist when registration is closed", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(403, "registration_closed"));
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/waitlist", { replace: true });
    });
  });

  // -- Error: email already taken (409) --

  it("shows email taken error on 409 status", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(409, "email_taken"));
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.emailTaken");
    });
  });

  // -- Error: invalid invite token --

  it("shows invalid invite error when token is expired", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(400, "invalid_or_expired_invite"));
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("waitlist.invalidInvite");
    });
  });

  // -- Error: invite email mismatch --

  it("shows email mismatch error for wrong invite email", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(400, "invite_email_mismatch"));
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("waitlist.emailMismatch");
    });
  });

  // -- Error: generic registration failure --

  it("shows generic error for unexpected failures", async () => {
    mockRegister.mockRejectedValue(new Error("Network error"));
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.registerError");
    });
  });

  // -- Loading state --

  it("shows derivingKey text and disables button while loading", async () => {
    let resolveRegister: (value: unknown) => void;
    mockRegister.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    renderPage();
    fillAllAndSubmit();
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "auth.derivingKey" });
      expect(btn).toBeDisabled();
    });

    // Resolve to clean up
    resolveRegister!({ message: "verification_email_sent" });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  // -- No error shown before submission --

  it("does not show an error message before form submission", () => {
    renderPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -- Clears previous error on step advance --

  it("clears error when advancing to next step", async () => {
    renderPage();
    // Trigger validation error on account step
    fillAccountStep({ confirmPassword: MISMATCHED_PW });
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Fix the field and advance
    fireEvent.change(screen.getByLabelText("auth.confirmPassword"), {
      target: { value: VALID_PW },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

describe("RegisterPage with invite token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateSalt.mockReturnValue("test-salt-base64");
  });

  it("shows approval banner when invite token is present", () => {
    render(
      <MemoryRouter initialEntries={["/register?invite=abc123"]}>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("waitlist.approvalBanner")).toBeInTheDocument();
  });

  it("does not show approval banner without invite token", () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(screen.queryByText("waitlist.approvalBanner")).not.toBeInTheDocument();
  });

  it("includes invite token in register request", async () => {
    mockRegister.mockResolvedValue({ message: "verification_email_sent" });
    mockDeriveKey.mockResolvedValue({} as CryptoKey);
    mockHashPassphrase.mockResolvedValue("hash");
    mockLoadOrMigrateKeyRing.mockResolvedValue({
      keys: new Map(),
      base64Map: new Map(),
    });

    render(
      <MemoryRouter initialEntries={["/register?invite=abc123"]}>
        <RegisterPage />
      </MemoryRouter>,
    );

    fillAllAndSubmit();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          invite_token: "abc123",
        }),
      );
    });
  });
});

// -- Helpers --

/** Fill the account step fields (step 1). */
function fillAccountStep(
  overrides: { email?: string; password?: string; confirmPassword?: string } = {},
) {
  const { email = "test@example.com", password = VALID_PW, confirmPassword = VALID_PW } = overrides;

  fireEvent.change(screen.getByLabelText("auth.email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("auth.password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("auth.confirmPassword"), {
    target: { value: confirmPassword },
  });
}

/** Fill the encryption step fields (step 2). */
function fillEncryptionStep(overrides: { passphrase?: string; confirmPassphrase?: string } = {}) {
  const { passphrase = VALID_PASSPHRASE, confirmPassphrase = VALID_PASSPHRASE } = overrides;

  fireEvent.change(screen.getByLabelText("auth.passphrase"), { target: { value: passphrase } });
  fireEvent.change(screen.getByLabelText("auth.confirmPassphrase"), {
    target: { value: confirmPassphrase },
  });
}

/** Advance to the encryption step by filling and submitting the account step. */
function advanceToEncryptionStep() {
  fillAccountStep();
  fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
}

/** Advance to the confirm step by going through account and encryption steps. */
function advanceToConfirmStep() {
  advanceToEncryptionStep();
  fillEncryptionStep();
  fireEvent.click(screen.getByRole("button", { name: "auth.stepNext" }));
}

/** Fill all steps and submit the final form. */
function fillAllAndSubmit() {
  advanceToConfirmStep();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "auth.register" }));
}
