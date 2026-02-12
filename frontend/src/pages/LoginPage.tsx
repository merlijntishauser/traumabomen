import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { login, ApiError } from "../lib/api";

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
      if (err instanceof ApiError) {
        setError(t("auth.loginError"));
      } else {
        setError(t("common.error"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>{t("app.title")}</h1>
      <h2>{t("auth.login")}</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">{t("auth.email")}</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password">{t("auth.password")}</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? t("common.loading") : t("auth.login")}
        </button>
      </form>

      <p>
        {t("auth.noAccount")}{" "}
        <Link to="/register">{t("auth.register")}</Link>
      </p>
    </div>
  );
}
