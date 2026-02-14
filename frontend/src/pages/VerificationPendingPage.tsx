import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { ApiError, resendVerification } from "../lib/api";
import "../styles/auth.css";

export default function VerificationPendingPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email ?? "";

  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setError("");
    setMessage("");

    try {
      await resendVerification({ email });
      setMessage(t("auth.resendSuccess"));
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(t("auth.resendTooSoon"));
      } else {
        setError(t("common.error"));
      }
    }
  }

  return (
    <div className="auth-page">
      <AuthHero />
      <div className="auth-content">
        <div className="auth-card">
          <h1>{t("app.title")}</h1>
          <h2>{t("auth.checkEmail")}</h2>

          <p className="auth-verification-text">
            {t("auth.verificationSent")} <strong>{email}</strong>
          </p>

          {message && <p className="auth-success">{message}</p>}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-submit" onClick={handleResend} disabled={cooldown > 0 || !email}>
            {cooldown > 0
              ? t("auth.resendCooldown", { seconds: cooldown })
              : t("auth.resendVerification")}
          </button>

          <p className="auth-footer">
            <Link to="/login">{t("auth.backToLogin")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
