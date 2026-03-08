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

vi.mock("../components/AuthWelcome", () => ({
  AuthWelcome: () => <div data-testid="auth-welcome" />,
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

  // -- Rendering --

  it("renders the registration form with all fields", () => {
    renderPage();
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.password")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.confirmPassword")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.passphrase")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.confirmPassphrase")).toBeInTheDocument();
    expect(screen.getByText("auth.acknowledgeWarning")).toBeInTheDocument();
    expect(screen.getByText("auth.passphraseWarning")).toBeInTheDocument();
  });

  it("renders the AuthHero and AuthWelcome components", () => {
    renderPage();
    expect(screen.getByTestId("auth-hero")).toBeInTheDocument();
    expect(screen.getByTestId("auth-welcome")).toBeInTheDocument();
  });

  it("renders password strength meter", () => {
    renderPage();
    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
  });

  it("renders a link to login page", () => {
    renderPage();
    expect(screen.getByText("auth.login")).toBeInTheDocument();
  });

  it("renders a link to privacy policy", () => {
    renderPage();
    expect(screen.getByText("landing.readPrivacyPolicy")).toBeInTheDocument();
  });

  it("submit button shows register label by default", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: "auth.register" });
    expect(btn).toBeInTheDocument();
  });

  // -- Validation: weak password --

  it("disables submit button when password is weak", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: "short" },
    });
    const btn = screen.getByRole("button", { name: "auth.register" });
    expect(btn).toBeDisabled();
  });

  it("enables submit button when password is not weak", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: VALID_PW },
    });
    const btn = screen.getByRole("button", { name: "auth.register" });
    expect(btn).not.toBeDisabled();
  });

  // -- Validation: password too long --

  it("shows error when password exceeds 64 characters", async () => {
    renderPage();
    const longPassword = "A".repeat(65);

    fillForm({ password: longPassword, confirmPassword: longPassword });
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passwordTooLong");
    });
  });

  // -- Validation: password mismatch --

  it("shows error when passwords do not match", async () => {
    renderPage();
    fillForm({ confirmPassword: MISMATCHED_PW });
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passwordMismatch");
    });
  });

  // -- Validation: passphrase too short --

  it("shows error when passphrase is shorter than 8 characters", async () => {
    renderPage();
    fillForm({ passphrase: SHORT_PASSPHRASE, confirmPassphrase: SHORT_PASSPHRASE });
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseTooShort");
    });
  });

  // -- Validation: passphrase mismatch --

  it("shows error when passphrases do not match", async () => {
    renderPage();
    fillForm({ confirmPassphrase: MISMATCHED_PASSPHRASE });
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.passphraseMismatch");
    });
  });

  // -- Validation: acknowledgment not checked --

  it("shows error when acknowledgment checkbox is not checked", async () => {
    renderPage();
    fillForm({ acknowledged: false });
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.mustAcknowledgeWarning");
    });
  });

  // -- Successful registration with verification flow --

  it("navigates to verify-pending when verification email is sent", async () => {
    mockRegister.mockResolvedValue({ message: "verification_email_sent" });
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

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

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

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

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

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

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/waitlist", { replace: true });
    });
  });

  // -- Error: email already taken (409) --

  it("shows email taken error on 409 status", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(409, "email_taken"));
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("auth.emailTaken");
    });
  });

  // -- Error: invalid invite token --

  it("shows invalid invite error when token is expired", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(400, "invalid_or_expired_invite"));
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("waitlist.invalidInvite");
    });
  });

  // -- Error: invite email mismatch --

  it("shows email mismatch error for wrong invite email", async () => {
    const { ApiError } = await import("../lib/api");
    mockRegister.mockRejectedValue(new ApiError(400, "invite_email_mismatch"));
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("waitlist.emailMismatch");
    });
  });

  // -- Error: generic registration failure --

  it("shows generic error for unexpected failures", async () => {
    mockRegister.mockRejectedValue(new Error("Network error"));
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

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

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

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

  // -- Clears previous error on new submit attempt --

  it("clears error on new submission attempt", async () => {
    mockRegister.mockRejectedValueOnce(new Error("fail"));
    mockRegister.mockResolvedValueOnce({ message: "verification_email_sent" });
    renderPage();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

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

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "auth.register" }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          invite_token: "abc123",
        }),
      );
    });
  });
});

// -- Helper --

/** Fills the registration form with valid defaults. Individual fields can be overridden. */
function fillForm(
  overrides: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    passphrase?: string;
    confirmPassphrase?: string;
    acknowledged?: boolean;
  } = {},
) {
  const {
    email = "test@example.com",
    password = VALID_PW,
    confirmPassword = VALID_PW,
    passphrase = VALID_PASSPHRASE,
    confirmPassphrase = VALID_PASSPHRASE,
    acknowledged = true,
  } = overrides;

  fireEvent.change(screen.getByLabelText("auth.email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("auth.password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("auth.confirmPassword"), {
    target: { value: confirmPassword },
  });
  fireEvent.change(screen.getByLabelText("auth.passphrase"), { target: { value: passphrase } });
  fireEvent.change(screen.getByLabelText("auth.confirmPassphrase"), {
    target: { value: confirmPassphrase },
  });

  const checkbox = screen.getByRole("checkbox");
  if (acknowledged && !checkbox.hasAttribute("checked")) {
    fireEvent.click(checkbox);
  }
}
