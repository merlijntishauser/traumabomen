import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { AuthWelcome } from "../components/AuthWelcome";
import { ApiError, login } from "../lib/api";
import "../styles/auth.css";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email, password });
      navigate("/trees", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.detail === "email_not_verified") {
        setError(t("auth.emailNotVerified"));
      } else if (err instanceof ApiError) {
        setError(t("auth.loginError"));
      } else {
        setError(t("common.error"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page--landing">
      <AuthHero />
      <div className="auth-content">
        <AuthWelcome />

        <div className="auth-card">
          <h2>{t("auth.login")}</h2>

          <form onSubmit={handleSubmit}>
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

            <div className="auth-field">
              <label htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-1p-allow
              />
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("auth.login")}
            </button>
          </form>

          <p className="auth-footer">
            {t("auth.noAccount")} <Link to="/register">{t("auth.register")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
