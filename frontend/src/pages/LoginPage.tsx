import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { login, ApiError } from "../lib/api";
import { deriveKey } from "../lib/crypto";
import { useEncryption } from "../contexts/EncryptionContext";

type Step = "credentials" | "passphrase";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setKey } = useEncryption();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [encryptionSalt, setEncryptionSalt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login({ email, password });
      setEncryptionSalt(response.encryption_salt);
      setStep("passphrase");
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

  async function handlePassphrase(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const derivedKey = await deriveKey(passphrase, encryptionSalt);
      setKey(derivedKey);
      navigate("/trees");
    } catch {
      setError(t("auth.passphraseError"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "passphrase") {
    return (
      <div>
        <h1>{t("app.title")}</h1>
        <h2>{t("auth.passphrase")}</h2>
        <p>{t("auth.passphrasePrompt")}</p>

        <form onSubmit={handlePassphrase}>
          <div>
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

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? t("auth.derivingKey") : t("auth.unlock")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>{t("app.title")}</h1>
      <h2>{t("auth.login")}</h2>

      <form onSubmit={handleCredentials}>
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
