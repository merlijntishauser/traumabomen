import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { register, ApiError } from "../lib/api";
import { generateSalt, deriveKey } from "../lib/crypto";
import { useEncryption } from "../contexts/EncryptionContext";
import "../styles/auth.css";

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setKey } = useEncryption();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (password !== confirmPassword) return t("auth.passwordMismatch");
    if (passphrase.length < 8) return t("auth.passphraseTooShort");
    if (passphrase !== confirmPassphrase) return t("auth.passphraseMismatch");
    if (!acknowledged) return t("auth.mustAcknowledgeWarning");
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const salt = generateSalt();
      await register({ email, password, encryption_salt: salt });
      const derivedKey = await deriveKey(passphrase, salt);
      setKey(derivedKey);
      navigate("/trees");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("auth.emailTaken"));
      } else {
        setError(t("auth.registerError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t("app.title")}</h1>
        <h2>{t("auth.register")}</h2>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">{t("auth.email")}</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">{t("auth.password")}</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword">{t("auth.confirmPassword")}</label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="passphrase">{t("auth.passphrase")}</label>
            <input
              id="passphrase"
              type="password"
              required
              minLength={8}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassphrase">
              {t("auth.confirmPassphrase")}
            </label>
            <input
              id="confirmPassphrase"
              type="password"
              required
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
            />
          </div>

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            {t("auth.acknowledgeWarning")}
          </label>

          <p className="auth-warning">{t("auth.passphraseWarning")}</p>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? t("auth.derivingKey") : t("auth.register")}
          </button>
        </form>

        <p className="auth-footer">
          {t("auth.hasAccount")} <Link to="/login">{t("auth.login")}</Link>
        </p>
      </div>
    </div>
  );
}
