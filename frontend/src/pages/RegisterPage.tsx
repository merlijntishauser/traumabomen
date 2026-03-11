import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
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

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setMasterKey, setPassphraseHash, setTreeKeys, setKeyRingBase64, setIsMigrated } =
    useEncryption();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [passphraseHint, setPassphraseHint] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const stepDots = (
    <div className="auth-steps" aria-hidden="true">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`auth-steps__dot${i === stepIndex ? " auth-steps__dot--active" : ""}${i < stepIndex ? " auth-steps__dot--done" : ""}`}
          aria-current={i === stepIndex ? "step" : undefined}
        />
      ))}
    </div>
  );

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
    setError("");

    if (step === "account") {
      const err = validateAccount();
      if (err) {
        setError(err);
        return;
      }
      setStep("encryption");
    } else if (step === "encryption") {
      const err = validateEncryption();
      if (err) {
        setError(err);
        return;
      }
      setStep("confirm");
    }
  }

  function handleBack() {
    setError("");
    if (step === "encryption") setStep("account");
    else if (step === "confirm") setStep("encryption");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const confirmError = validateConfirm();
    if (confirmError) {
      setError(confirmError);
      return;
    }

    setLoading(true);
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
      setError(getRegistrationError(err, t));
    } finally {
      setLoading(false);
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
            <form onSubmit={handleNext} data-testid="step-account">
              <div className="auth-field-group">
                <div className="auth-field">
                  <label htmlFor="email">{t("auth.email")}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-1p-allow
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <div className="auth-field">
                  <label htmlFor="password">{t("auth.password")}</label>
                  <input
                    id="password"
                    type="password"
                    required
                    maxLength={64}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-1p-allow
                  />
                  <PasswordStrengthMeter password={password} />
                </div>

                <div className="auth-field">
                  <label htmlFor="confirmPassword">{t("auth.confirmPassword")}</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
          )}

          {step === "encryption" && (
            <form onSubmit={handleNext} data-testid="step-encryption">
              <div className="auth-field-group">
                <div className="auth-field">
                  <label htmlFor="passphrase">{t("auth.passphrase")}</label>
                  <input
                    id="passphrase"
                    type="password"
                    required
                    minLength={8}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    data-1p-ignore
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="confirmPassphrase">{t("auth.confirmPassphrase")}</label>
                  <input
                    id="confirmPassphrase"
                    type="password"
                    required
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    data-1p-ignore
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
                    onChange={(e) => setPassphraseHint(e.target.value)}
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
                <button className="auth-step-back" type="button" onClick={handleBack}>
                  {t("auth.stepBack")}
                </button>
                <button className="auth-submit auth-submit--flex" type="submit">
                  {t("auth.stepNext")}
                </button>
              </div>
            </form>
          )}

          {step === "confirm" && (
            <form onSubmit={handleSubmit} data-testid="step-confirm">
              <p className="auth-warning auth-warning--prominent">{t("auth.passphraseWarning")}</p>

              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                {t("auth.acknowledgeWarning")}
              </label>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <div className="auth-step-buttons">
                <button
                  className="auth-step-back"
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                >
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
          )}

          <p className="auth-footer">
            {t("auth.hasAccount")} <Link to="/login">{t("auth.login")}</Link>
          </p>

          <p className="auth-footer">
            <Link to="/privacy">{t("landing.readPrivacyPolicy")}</Link>
          </p>

          {stepDots}
        </div>
      </div>
    </div>
  );
}
