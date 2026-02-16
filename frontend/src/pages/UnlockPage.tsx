import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { useEncryption } from "../contexts/EncryptionContext";
import { ApiError, clearTokens, getEncryptionSalt } from "../lib/api";
import { deriveKey, hashPassphrase } from "../lib/crypto";
import "../styles/auth.css";

export default function UnlockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setKey, setPassphraseHash } = useEncryption();
  const returnTo = (location.state as { from?: string })?.from || "/trees";

  const [passphrase, setPassphrase] = useState("");
  const [salt, setSalt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEncryptionSalt()
      .then((res) => {
        if (!cancelled) setSalt(res.encryption_salt);
      })
      .catch((err) => {
        if (cancelled) return;
        // Token expired or invalid -- need full login
        if (err instanceof ApiError && err.status === 401) {
          clearTokens();
        }
        navigate("/login", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salt) return;
    setError("");
    setLoading(true);

    try {
      const derivedKey = await deriveKey(passphrase, salt);
      const hash = await hashPassphrase(passphrase);
      setKey(derivedKey);
      setPassphraseHash(hash);
      navigate(returnTo, { replace: true });
    } catch {
      setError(t("auth.passphraseError"));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearTokens();
    navigate("/login", { replace: true });
  }

  if (!salt) {
    return (
      <div className="auth-page">
        <AuthHero variant="unlock" />
        <div className="auth-content">
          <div className="auth-card">
            <h1>{t("app.title")}</h1>
            <p>{t("common.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <AuthHero variant="unlock" />
      <div className="auth-content">
        <div className="auth-card">
          <h1>{t("app.title")}</h1>
          <h2>{t("auth.passphrase")}</h2>
          <p className="auth-prompt">{t("auth.passphrasePrompt")}</p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="passphrase">{t("auth.passphrase")}</label>
              <input
                id="passphrase"
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
              />
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? t("auth.derivingKey") : t("auth.unlock")}
            </button>
          </form>

          <p className="auth-footer">
            <button type="button" className="auth-link-btn" onClick={handleLogout}>
              {t("auth.switchAccount")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
