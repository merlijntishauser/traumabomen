import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { ApiError, joinWaitlist } from "../lib/api";
import "../styles/auth.css";

export default function WaitlistPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await joinWaitlist(email);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.detail === "already_on_waitlist") {
          setError(t("waitlist.alreadyOnList"));
        } else if (err.detail === "already_registered") {
          setError(t("waitlist.alreadyRegistered"));
        } else {
          setError(t("waitlist.error"));
        }
      } else {
        setError(t("waitlist.error"));
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
          <h2>{t("waitlist.title")}</h2>

          {success ? (
            <div className="auth-success">{t("waitlist.success")}</div>
          ) : (
            <>
              <p className="auth-prompt">{t("waitlist.subtitle")}</p>

              <form onSubmit={handleSubmit}>
                <div className="auth-field">
                  <label htmlFor="email">{t("auth.email")}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder={t("waitlist.emailPlaceholder")}
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
                  {loading ? t("common.loading") : t("waitlist.joinButton")}
                </button>
              </form>
            </>
          )}

          <p className="auth-footer">
            {t("auth.hasAccount")} <Link to="/login">{t("auth.login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
