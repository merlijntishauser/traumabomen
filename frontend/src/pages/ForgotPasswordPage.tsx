import { Lock, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { forgotPassword } from "../lib/api";
import "../styles/auth.css";

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword({ email, language: i18n.language });
      setSent(true);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page--centered">
      <AuthHero homeLink />
      <div className="auth-content">
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__icon">
              <Lock size={24} aria-hidden="true" />
            </div>
            <h2>{t("auth.forgotPasswordTitle")}</h2>
          </div>

          {sent ? (
            <>
              <p className="auth-verification-text">{t("auth.forgotPasswordSent")}</p>
              <Link
                to="/login"
                className="auth-submit"
                style={{ display: "block", textAlign: "center" }}
              >
                {t("auth.backToLogin")}
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-step-intro">{t("auth.forgotPasswordPrompt")}</p>

              <div className="auth-field">
                <label htmlFor="email">
                  <Mail size={13} className="auth-label-icon" aria-hidden="true" />
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? t("common.loading") : t("auth.sendResetLink")}
              </button>
            </form>
          )}

          {!sent && (
            <p className="auth-footer">
              <Link to="/login">{t("auth.backToLogin")}</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
