import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { ApiError, resetPassword } from "../lib/api";
import "../styles/auth.css";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(t("auth.newPasswordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token: token!, new_password: password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.detail === "invalid_or_expired_token") {
        setError(t("auth.resetPasswordFailed"));
      } else if (err instanceof ApiError && err.detail === "password_too_weak") {
        setError(t("auth.passwordTooWeak"));
      } else {
        setError(t("common.error"));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page auth-page--centered">
        <AuthHero />
        <div className="auth-content">
          <div className="auth-card">
            <h2>{t("auth.resetPasswordTitle")}</h2>
            <p className="auth-error" role="alert">
              {t("auth.resetPasswordFailed")}
            </p>
            <p className="auth-footer">
              <Link to="/forgot-password">{t("auth.requestNewReset")}</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page--centered">
      <AuthHero />
      <div className="auth-content">
        <div className="auth-card">
          <h2>{t("auth.resetPasswordTitle")}</h2>

          {success ? (
            <>
              <p className="auth-success">{t("auth.resetPasswordSuccess")}</p>
              <Link
                to="/login"
                className="auth-submit"
                style={{ display: "block", textAlign: "center" }}
              >
                {t("auth.login")}
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-step-intro">{t("auth.resetPasswordNote")}</p>

              <div className="auth-field">
                <label htmlFor="new-password">{t("auth.newPassword")}</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirm-password">{t("auth.confirmNewPassword")}</label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? t("common.loading") : t("auth.resetPassword")}
              </button>
            </form>
          )}

          <p className="auth-footer">
            <Link to="/login">{t("auth.backToLogin")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
