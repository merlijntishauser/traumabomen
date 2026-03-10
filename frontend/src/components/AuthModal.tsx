import { Lock, LogIn } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, login as apiLogin, getEncryptionSalt } from "../lib/api";
import { deriveKey, hashPassphrase } from "../lib/crypto";
import { loadOrMigrateKeyRing } from "../lib/keyRingLoader";
import "./AuthModal.css";

interface UnlockResult {
  masterKey: CryptoKey;
  passphraseHash: string;
  treeKeys: Map<string, CryptoKey>;
  keyRingBase64: Map<string, string>;
}

interface Props {
  mode: "unlock" | "reauth";
  hint: string | null;
  salt: string | null;
  onUnlockSuccess: (result: UnlockResult) => void;
  onReauthSuccess: (result: UnlockResult) => void;
  onLogout: () => void;
}

export function AuthModal({ mode, hint, salt, onUnlockSuccess, onReauthSuccess, onLogout }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"credentials" | "passphrase">(
    mode === "reauth" ? "credentials" : "passphrase",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [currentSalt, setCurrentSalt] = useState(salt);
  const [currentHint, setCurrentHint] = useState(hint);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update salt/hint when props change
  useEffect(() => {
    setCurrentSalt(salt);
    setCurrentHint(hint);
  }, [salt, hint]);

  // Auto-focus first input when step changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: step triggers re-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  // Reset to correct step when mode changes
  useEffect(() => {
    setStep(mode === "reauth" ? "credentials" : "passphrase");
    setError("");
  }, [mode]);

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiLogin({ email, password });
      // Fetch salt + hint after login
      const saltResp = await getEncryptionSalt();
      setCurrentSalt(saltResp.encryption_salt);
      setCurrentHint(saltResp.passphrase_hint);
      setStep("passphrase");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t(`auth.${err.detail || "loginError"}`));
      } else {
        setError(t("auth.loginError"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePassphraseSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentSalt) return;
    setError("");
    setLoading(true);
    try {
      const derivedKey = await deriveKey(passphrase, currentSalt);
      const hash = await hashPassphrase(passphrase);
      setMigrating(true);
      const { keys, base64Map } = await loadOrMigrateKeyRing(derivedKey);
      setMigrating(false);
      const result: UnlockResult = {
        masterKey: derivedKey,
        passphraseHash: hash,
        treeKeys: keys,
        keyRingBase64: base64Map,
      };
      if (mode === "reauth") {
        onReauthSuccess(result);
      } else {
        onUnlockSuccess(result);
      }
    } catch {
      setMigrating(false);
      setError(t("auth.passphraseError"));
    } finally {
      setLoading(false);
    }
  }

  const showCredentials = step === "credentials";
  const showPassphrase = step === "passphrase";
  const unlockLabel = t("auth.unlock");

  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-label={unlockLabel}>
      <div className="auth-modal__card">
        <picture>
          <source srcSet="/images/hero-unlock-dark.webp" type="image/webp" />
          <img
            className="auth-modal__bg auth-modal__bg--dark"
            src="/images/hero-unlock-dark.jpg"
            alt=""
            aria-hidden="true"
          />
        </picture>
        <picture>
          <source srcSet="/images/hero-unlock-light.webp" type="image/webp" />
          <img
            className="auth-modal__bg auth-modal__bg--light"
            src="/images/hero-unlock-light.jpg"
            alt=""
            aria-hidden="true"
          />
        </picture>
        <div className="auth-modal__content">
          <div className="auth-modal__icon">
            {showCredentials ? (
              <LogIn size={24} aria-hidden="true" />
            ) : (
              <Lock size={24} aria-hidden="true" />
            )}
          </div>
          <h2 className="auth-modal__title">
            {showCredentials ? t("auth.loginTitle") : unlockLabel}
          </h2>
          <p className="auth-modal__subtitle">
            {showCredentials ? t("auth.sessionExpired") : t("auth.passphrasePrompt")}
          </p>

          {mode === "reauth" && (
            <div className="auth-modal__steps">
              <span
                className={`auth-modal__step ${showCredentials ? "auth-modal__step--active" : "auth-modal__step--done"}`}
              >
                1
              </span>
              <span
                className={`auth-modal__step ${showPassphrase ? "auth-modal__step--active" : ""}`}
              >
                2
              </span>
            </div>
          )}

          {showCredentials && (
            <form className="auth-modal__form" onSubmit={handleCredentialsSubmit}>
              <div className="auth-field">
                <label htmlFor="auth-modal-email">{t("auth.email")}</label>
                <input
                  ref={inputRef}
                  id="auth-modal-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="auth-modal-password">{t("auth.password")}</label>
                <input
                  id="auth-modal-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button className="auth-modal__submit" type="submit" disabled={loading}>
                {loading ? t("common.loading") : t("auth.login")}
              </button>
            </form>
          )}

          {showPassphrase && (
            <form className="auth-modal__form" onSubmit={handlePassphraseSubmit}>
              <div className="auth-field">
                <label htmlFor="auth-modal-passphrase">{t("auth.passphrase")}</label>
                <input
                  ref={showCredentials ? undefined : inputRef}
                  id="auth-modal-passphrase"
                  type="password"
                  required
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  data-1p-ignore
                />
              </div>
              {currentHint && (
                <div className="auth-modal__hint" data-testid="auth-modal-hint">
                  <span className="auth-modal__hint-label">{t("auth.hintLabel")}</span>
                  <span className="auth-modal__hint-text">{currentHint}</span>
                </div>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="auth-modal__submit"
                type="submit"
                disabled={loading || !currentSalt}
              >
                {migrating
                  ? t("auth.migratingData")
                  : loading
                    ? t("auth.derivingKey")
                    : unlockLabel}
              </button>
            </form>
          )}

          <button type="button" className="auth-modal__logout" onClick={onLogout}>
            {t("auth.switchAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
