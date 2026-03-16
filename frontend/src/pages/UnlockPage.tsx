import { type FormEvent, useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { PassphraseInput } from "../components/PassphraseInput";
import { useEncryption } from "../contexts/useEncryption";
import { ApiError, clearTokens, getEncryptionSalt } from "../lib/api";
import { deriveKey, hashPassphrase } from "../lib/crypto";
import { loadOrMigrateKeyRing } from "../lib/keyRingLoader";
import "../styles/auth.css";

interface UnlockFormState {
  passphrase: string;
  error: string;
  loading: boolean;
  migrating: boolean;
}

type UnlockFormAction =
  | { type: "SET_PASSPHRASE"; passphrase: string }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_MIGRATING"; migrating: boolean };

const unlockFormInitialState: UnlockFormState = {
  passphrase: "",
  error: "",
  loading: false,
  migrating: false,
};

function unlockFormReducer(state: UnlockFormState, action: UnlockFormAction): UnlockFormState {
  switch (action.type) {
    case "SET_PASSPHRASE":
      return { ...state, passphrase: action.passphrase };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_MIGRATING":
      return { ...state, migrating: action.migrating };
  }
}

export default function UnlockPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setMasterKey, setPassphraseHash, setTreeKeys, setKeyRingBase64, setIsMigrated } =
    useEncryption();
  const returnTo = (location.state as { from?: string })?.from || "/trees";

  const [salt, setSalt] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [form, dispatch] = useReducer(unlockFormReducer, unlockFormInitialState);

  useEffect(() => {
    let cancelled = false;
    getEncryptionSalt()
      .then((res) => {
        if (!cancelled) {
          setSalt(res.encryption_salt);
          setHint(res.passphrase_hint);
        }
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
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_LOADING", loading: true });

    try {
      const derivedKey = await deriveKey(form.passphrase, salt);
      const hash = await hashPassphrase(form.passphrase);
      setMasterKey(derivedKey);
      setPassphraseHash(hash);

      dispatch({ type: "SET_MIGRATING", migrating: true });
      const { keys, base64Map } = await loadOrMigrateKeyRing(derivedKey);
      setTreeKeys(keys);
      setKeyRingBase64(base64Map);
      setIsMigrated(true);
      dispatch({ type: "SET_MIGRATING", migrating: false });

      navigate(returnTo, { replace: true });
    } catch {
      dispatch({ type: "SET_MIGRATING", migrating: false });
      dispatch({ type: "SET_ERROR", error: t("auth.passphraseError") });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
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
              <PassphraseInput
                id="passphrase"
                required
                value={form.passphrase}
                onChange={(e) => dispatch({ type: "SET_PASSPHRASE", passphrase: e.target.value })}
              />
            </div>

            {hint && (
              <div className="auth-hint-block">
                <span className="auth-hint-block__label">{t("auth.hintLabel")}</span>
                <span className="auth-hint-block__text">{hint}</span>
              </div>
            )}

            {form.error && (
              <p className="auth-error" role="alert">
                {form.error}
              </p>
            )}

            <button className="auth-submit" type="submit" disabled={form.loading}>
              {form.migrating
                ? t("auth.migratingData")
                : form.loading
                  ? t("auth.derivingKey")
                  : t("auth.unlock")}
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
