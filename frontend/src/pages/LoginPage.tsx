import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { login, ApiError } from "../lib/api";
import { AuthHero } from "../components/AuthHero";
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
      navigate("/unlock", { replace: true });
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
    <div className="auth-page">
      <AuthHero />
      <div className="auth-content">
        <div className="auth-card">
          <h1>{t("app.title")}</h1>
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

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("auth.login")}
            </button>
          </form>

          <p className="auth-footer">
            {t("auth.noAccount")}{" "}
            <Link to="/register">{t("auth.register")}</Link>
          </p>

          <div className="auth-explainer">
            <p className="auth-explainer__tagline">{t("landing.tagline")}</p>
            <p className="auth-explainer__text">{t("landing.about")}</p>
            <h3 className="auth-explainer__heading">{t("landing.privacyHeading")}</h3>
            <p className="auth-explainer__text">{t("landing.privacy")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
