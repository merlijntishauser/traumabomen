import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { ApiError, resendVerification } from "../lib/api";
import "../styles/auth.css";

export default function VerificationPendingPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email ?? "";

  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setError("");
    setMessage("");

    try {
      await resendVerification({ email, language: i18n.language });
      setMessage(t("auth.resendSuccess"));
      setCooldown(60);
      intervalRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
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

          <button
            type="button"
            className="auth-submit"
            onClick={handleResend}
            disabled={cooldown > 0 || !email}
          >
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
