import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { getEncryptionSalt, clearTokens, ApiError } from "../lib/api";
import { deriveKey } from "../lib/crypto";
import { useEncryption } from "../contexts/EncryptionContext";
import "../styles/auth.css";

export default function UnlockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setKey } = useEncryption();

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
      setKey(derivedKey);
      navigate("/trees", { replace: true });
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
        <div className="auth-card">
          <h1>{t("app.title")}</h1>
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" data-1p-ignore>
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

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? t("auth.derivingKey") : t("auth.unlock")}
          </button>
        </form>

        <p className="auth-footer">
          <button className="auth-link-btn" onClick={handleLogout}>
            {t("auth.switchAccount")}
          </button>
        </p>
      </div>
    </div>
  );
}
