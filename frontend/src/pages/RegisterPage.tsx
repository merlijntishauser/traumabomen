import { Check } from "lucide-react";
import type React from "react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { PassphraseInput } from "../components/PassphraseInput";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { useEncryption } from "../contexts/useEncryption";
import { ApiError, register } from "../lib/api";
import { deriveKey, generateSalt, hashPassphrase } from "../lib/crypto";
import { loadOrMigrateKeyRing } from "../lib/keyRingLoader";
import { getPasswordStrength } from "../lib/passwordStrength";
import "../styles/auth.css";

type Step = "account" | "encryption" | "confirm";
const STEPS: Step[] = ["account", "encryption", "confirm"];

function getRegistrationError(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError && err.status === 409) return t("auth.emailTaken");
  if (err instanceof ApiError && err.detail === "invalid_or_expired_invite")
    return t("waitlist.invalidInvite");
  if (err instanceof ApiError && err.detail === "invite_email_mismatch")
    return t("waitlist.emailMismatch");
  return t("auth.registerError");
}

interface RegisterState {
  step: Step;
  email: string;
  password: string;
  confirmPassword: string;
  passphrase: string;
  confirmPassphrase: string;
  passphraseHint: string;
  acknowledged: boolean;
  error: string;
  loading: boolean;
}

type RegisterAction =
  | { type: "SET_FIELD"; field: keyof RegisterState; value: string | boolean }
  | { type: "SET_STEP"; step: Step }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_LOADING"; loading: boolean };

const registerInitialState: RegisterState = {
  step: "account",
  email: "",
  password: "",
  confirmPassword: "",
  passphrase: "",
  confirmPassphrase: "",
  passphraseHint: "",
  acknowledged: false,
  error: "",
  loading: false,
};

function registerReducer(state: RegisterState, action: RegisterAction): RegisterState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
  }
}

/* -- Sub-components -------------------------------------------------------- */

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const { t } = useTranslation();
  const stepIndex = STEPS.indexOf(currentStep);
  return (
    <nav className="auth-steps" aria-label={t("auth.stepProgress")}>
      {STEPS.map((s, i) => {
        const isDone = i < stepIndex;
        const isActive = i === stepIndex;
        const modifier = isDone
          ? " auth-steps__item--done"
          : isActive
            ? " auth-steps__item--active"
            : "";
        return (
          <div key={s} className={`auth-steps__item${modifier}`}>
            {i > 0 && (
              <span
                className={`auth-steps__line${i <= stepIndex ? " auth-steps__line--done" : ""}`}
              />
            )}
            <span className="auth-steps__circle" aria-current={isActive ? "step" : undefined}>
              {isDone ? <Check size={12} aria-hidden="true" /> : i + 1}
            </span>
            <span className="auth-steps__label">{t(`auth.stepLabel.${s}`)}</span>
          </div>
        );
      })}
    </nav>
  );
}

interface AccountStepProps {
  email: string;
  password: string;
  confirmPassword: string;
  error: string;
  dispatch: React.Dispatch<RegisterAction>;
  onNext: (e: FormEvent) => void;
}

function AccountStepForm({
  email,
  password,
  confirmPassword,
  error,
  dispatch,
  onNext,
}: AccountStepProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onNext} data-testid="step-account">
      <div className="auth-field-group">
        <div className="auth-field">
          <label htmlFor="email">{t("auth.email")}</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })}
            data-1p-allow
          />
        </div>
      </div>

      <div className="auth-field-group">
        <div className="auth-field">
          <label htmlFor="password">{t("auth.password")}</label>
          <PasswordInput
            id="password"
            required
            maxLength={64}
            value={password}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })
            }
            data-1p-allow
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">{t("auth.confirmPassword")}</label>
          <PasswordInput
            id="confirmPassword"
            required
            value={confirmPassword}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "confirmPassword",
                value: e.target.value,
              })
            }
            data-1p-allow
          />
        </div>
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="auth-submit"
        type="submit"
        disabled={getPasswordStrength(password).level === "weak"}
      >
        {t("auth.stepNext")}
      </button>
    </form>
  );
}

interface EncryptionStepProps {
  passphrase: string;
  confirmPassphrase: string;
  passphraseHint: string;
  error: string;
  dispatch: React.Dispatch<RegisterAction>;
  onNext: (e: FormEvent) => void;
  onBack: () => void;
}

function EncryptionStepForm({
  passphrase,
  confirmPassphrase,
  passphraseHint,
  error,
  dispatch,
  onNext,
  onBack,
}: EncryptionStepProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onNext} data-testid="step-encryption">
      <div className="auth-field-group">
        <div className="auth-field">
          <label htmlFor="passphrase">{t("auth.passphrase")}</label>
          <PassphraseInput
            id="passphrase"
            required
            minLength={8}
            value={passphrase}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "passphrase", value: e.target.value })
            }
          />
          <p className="auth-field__hint">{t("auth.passphraseMinLength")}</p>
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassphrase">{t("auth.confirmPassphrase")}</label>
          <PassphraseInput
            id="confirmPassphrase"
            required
            value={confirmPassphrase}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "confirmPassphrase",
                value: e.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="auth-field-group">
        <div className="auth-field">
          <label htmlFor="passphraseHint">{t("auth.hintFieldLabel")}</label>
          <input
            id="passphraseHint"
            type="text"
            maxLength={255}
            value={passphraseHint}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "passphraseHint",
                value: e.target.value,
              })
            }
            placeholder={t("auth.hintPlaceholder")}
            data-1p-ignore
          />
          <p className="auth-field__hint">{t("auth.hintHelperText")}</p>
        </div>
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="auth-step-buttons">
        <button className="auth-step-back" type="button" onClick={onBack}>
          {t("auth.stepBack")}
        </button>
        <button className="auth-submit auth-submit--flex" type="submit">
          {t("auth.stepNext")}
        </button>
      </div>
    </form>
  );
}

interface ConfirmStepProps {
  acknowledged: boolean;
  error: string;
  loading: boolean;
  dispatch: React.Dispatch<RegisterAction>;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}

function ConfirmStepForm({
  acknowledged,
  error,
  loading,
  dispatch,
  onSubmit,
  onBack,
}: ConfirmStepProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} data-testid="step-confirm">
      <p className="auth-warning auth-warning--prominent">{t("auth.passphraseWarning")}</p>

      <label className="auth-checkbox">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "acknowledged", value: e.target.checked })
          }
        />
        {t("auth.acknowledgeWarning")}
      </label>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <div className="auth-step-buttons">
        <button className="auth-step-back" type="button" onClick={onBack} disabled={loading}>
          {t("auth.stepBack")}
        </button>
        <button
          className="auth-submit auth-submit--flex"
          type="submit"
          disabled={loading || !acknowledged}
        >
          {loading ? t("auth.derivingKey") : t("auth.register")}
        </button>
      </div>
    </form>
  );
}

/* -- Main component -------------------------------------------------------- */

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setMasterKey, setPassphraseHash, setTreeKeys, setKeyRingBase64, setIsMigrated } =
    useEncryption();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [state, dispatch] = useReducer(registerReducer, registerInitialState);
  const {
    step,
    email,
    password,
    confirmPassword,
    passphrase,
    confirmPassphrase,
    passphraseHint,
    acknowledged,
    error,
    loading,
  } = state;

  function validateAccount(): string | null {
    if (getPasswordStrength(password).level === "weak") return t("auth.passwordTooWeak");
    if (password.length > 64) return t("auth.passwordTooLong");
    if (password !== confirmPassword) return t("auth.passwordMismatch");
    return null;
  }

  function validateEncryption(): string | null {
    if (passphrase.length < 8) return t("auth.passphraseTooShort");
    if (passphrase !== confirmPassphrase) return t("auth.passphraseMismatch");
    return null;
  }

  function validateConfirm(): string | null {
    if (!acknowledged) return t("auth.mustAcknowledgeWarning");
    return null;
  }

  function handleNext(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });

    if (step === "account") {
      const err = validateAccount();
      if (err) {
        dispatch({ type: "SET_ERROR", error: err });
        return;
      }
      dispatch({ type: "SET_STEP", step: "encryption" });
    } else if (step === "encryption") {
      const err = validateEncryption();
      if (err) {
        dispatch({ type: "SET_ERROR", error: err });
        return;
      }
      dispatch({ type: "SET_STEP", step: "confirm" });
    }
  }

  function handleBack() {
    dispatch({ type: "SET_ERROR", error: "" });
    if (step === "encryption") dispatch({ type: "SET_STEP", step: "account" });
    else if (step === "confirm") dispatch({ type: "SET_STEP", step: "encryption" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });

    const confirmError = validateConfirm();
    if (confirmError) {
      dispatch({ type: "SET_ERROR", error: confirmError });
      return;
    }

    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const salt = generateSalt();
      const registerRequest: {
        email: string;
        password: string;
        encryption_salt: string;
        invite_token?: string;
        language: string;
        passphrase_hint?: string;
      } = {
        email,
        password,
        encryption_salt: salt,
        language: i18n.language,
        passphrase_hint: passphraseHint || undefined,
      };
      if (inviteToken) {
        registerRequest.invite_token = inviteToken;
      }
      const result = await register(registerRequest);

      if ("message" in result && result.message === "verification_email_sent") {
        navigate("/verify-pending", { state: { email } });
        return;
      }

      const derivedKey = await deriveKey(passphrase, salt);
      const hash = await hashPassphrase(passphrase);
      setMasterKey(derivedKey);
      setPassphraseHash(hash);
      const { keys, base64Map } = await loadOrMigrateKeyRing(derivedKey);
      setTreeKeys(keys);
      setKeyRingBase64(base64Map);
      setIsMigrated(true);
      navigate("/trees");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.detail === "registration_closed") {
        navigate("/waitlist", { replace: true });
        return;
      }
      dispatch({ type: "SET_ERROR", error: getRegistrationError(err, t) });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  return (
    <div className="auth-page auth-page--centered">
      <AuthHero />
      <div className="auth-content">
        <div className="auth-card">
          <h2>{t(`auth.stepTitle.${step}`)}</h2>
          <p className="auth-step-intro">{t(`auth.stepSubtitle.${step}`)}</p>

          {inviteToken && <div className="auth-success">{t("waitlist.approvalBanner")}</div>}

          {step === "account" && (
            <AccountStepForm
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              error={error}
              dispatch={dispatch}
              onNext={handleNext}
            />
          )}

          {step === "encryption" && (
            <EncryptionStepForm
              passphrase={passphrase}
              confirmPassphrase={confirmPassphrase}
              passphraseHint={passphraseHint}
              error={error}
              dispatch={dispatch}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {step === "confirm" && (
            <ConfirmStepForm
              acknowledged={acknowledged}
              error={error}
              loading={loading}
              dispatch={dispatch}
              onSubmit={handleSubmit}
              onBack={handleBack}
            />
          )}

          <p className="auth-footer">
            {t("auth.hasAccount")} <Link to="/login">{t("auth.login")}</Link>
          </p>

          <p className="auth-footer">
            <Link to="/privacy">{t("landing.readPrivacyPolicy")}</Link>
          </p>

          <StepIndicator currentStep={step} />
        </div>
      </div>
    </div>
  );
}
