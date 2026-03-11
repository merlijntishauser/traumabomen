import { Lock, LogIn } from "lucide-react";
import { type FormEvent, useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, login as apiLogin, getEncryptionSalt } from "../lib/api";
import { deriveKey, hashPassphrase } from "../lib/crypto";
import { loadOrMigrateKeyRing } from "../lib/keyRingLoader";
import "./AuthModal.css";

interface UnlockResult {
  masterKey: CryptoKey;
  passphraseHash: string;
  treeKeys: Map<string, CryptoKey>;
  keyRingBase64: Map<string, string>;
}

interface Props {
  mode: "unlock" | "reauth";
  hint: string | null;
  salt: string | null;
  onUnlockSuccess: (result: UnlockResult) => void;
  onReauthSuccess: (result: UnlockResult) => void;
  onLogout: () => void;
}

interface AuthModalFormState {
  credentialsSubmitted: boolean;
  email: string;
  password: string;
  passphrase: string;
  error: string;
  loading: boolean;
  migrating: boolean;
  fetchedSalt: string | null;
  fetchedHint: string | null;
  prevMode: "unlock" | "reauth";
}

type AuthModalFormAction =
  | { type: "SET_FIELD"; field: "email" | "password" | "passphrase"; value: string }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_MIGRATING"; migrating: boolean }
  | { type: "CREDENTIALS_SUCCESS"; salt: string; hint: string | null }
  | { type: "MODE_CHANGED"; mode: "unlock" | "reauth" };

function authModalFormReducer(
  state: AuthModalFormState,
  action: AuthModalFormAction,
): AuthModalFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_MIGRATING":
      return { ...state, migrating: action.migrating };
    case "CREDENTIALS_SUCCESS":
      return {
        ...state,
        credentialsSubmitted: true,
        fetchedSalt: action.salt,
        fetchedHint: action.hint,
      };
    case "MODE_CHANGED":
      return {
        ...state,
        prevMode: action.mode,
        credentialsSubmitted: false,
        fetchedSalt: null,
        fetchedHint: null,
        error: "",
      };
  }
}

export function AuthModal({ mode, hint, salt, onUnlockSuccess, onReauthSuccess, onLogout }: Props) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(authModalFormReducer, {
    credentialsSubmitted: false,
    email: "",
    password: "",
    passphrase: "",
    error: "",
    loading: false,
    migrating: false,
    fetchedSalt: null,
    fetchedHint: null,
    prevMode: mode,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive step and effective salt/hint from props + local state
  const step = mode === "reauth" && !state.credentialsSubmitted ? "credentials" : "passphrase";
  const currentSalt = state.fetchedSalt ?? salt;
  const currentHint = state.fetchedHint ?? hint;

  // Reset local state when mode changes
  if (mode !== state.prevMode) {
    dispatch({ type: "MODE_CHANGED", mode });
  }

  // Auto-focus first input when step changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: step triggers re-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      await apiLogin({ email: state.email, password: state.password });
      // Fetch salt + hint after login
      const saltResp = await getEncryptionSalt();
      dispatch({
        type: "CREDENTIALS_SUCCESS",
        salt: saltResp.encryption_salt,
        hint: saltResp.passphrase_hint,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        dispatch({ type: "SET_ERROR", error: t(`auth.${err.detail || "loginError"}`) });
      } else {
        dispatch({ type: "SET_ERROR", error: t("auth.loginError") });
      }
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  async function handlePassphraseSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentSalt) return;
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const derivedKey = await deriveKey(state.passphrase, currentSalt);
      const hash = await hashPassphrase(state.passphrase);
      dispatch({ type: "SET_MIGRATING", migrating: true });
      const { keys, base64Map } = await loadOrMigrateKeyRing(derivedKey);
      dispatch({ type: "SET_MIGRATING", migrating: false });
      const result: UnlockResult = {
        masterKey: derivedKey,
        passphraseHash: hash,
        treeKeys: keys,
        keyRingBase64: base64Map,
      };
      if (mode === "reauth") {
        onReauthSuccess(result);
      } else {
        onUnlockSuccess(result);
      }
    } catch {
      dispatch({ type: "SET_MIGRATING", migrating: false });
      dispatch({ type: "SET_ERROR", error: t("auth.passphraseError") });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  const showCredentials = step === "credentials";
  const showPassphrase = step === "passphrase";
  const unlockLabel = t("auth.unlock");

  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-label={unlockLabel}>
      <div className="auth-modal__card">
        <picture>
          <source srcSet="/images/hero-unlock-dark.webp" type="image/webp" />
          <img
            className="auth-modal__bg auth-modal__bg--dark"
            src="/images/hero-unlock-dark.jpg"
            alt=""
            aria-hidden="true"
          />
        </picture>
        <picture>
          <source srcSet="/images/hero-unlock-light.webp" type="image/webp" />
          <img
            className="auth-modal__bg auth-modal__bg--light"
            src="/images/hero-unlock-light.jpg"
            alt=""
            aria-hidden="true"
          />
        </picture>
        <div className="auth-modal__content">
          <div className="auth-modal__icon">
            {showCredentials ? (
              <LogIn size={24} aria-hidden="true" />
            ) : (
              <Lock size={24} aria-hidden="true" />
            )}
          </div>
          <h2 className="auth-modal__title">
            {showCredentials ? t("auth.loginTitle") : unlockLabel}
          </h2>
          <p className="auth-modal__subtitle">
            {showCredentials ? t("auth.sessionExpired") : t("auth.passphrasePrompt")}
          </p>

          {mode === "reauth" && (
            <div className="auth-modal__steps">
              <span
                className={`auth-modal__step ${showCredentials ? "auth-modal__step--active" : "auth-modal__step--done"}`}
              >
                1
              </span>
              <span
                className={`auth-modal__step ${showPassphrase ? "auth-modal__step--active" : ""}`}
              >
                2
              </span>
            </div>
          )}

          {showCredentials && (
            <form className="auth-modal__form" onSubmit={handleCredentialsSubmit}>
              <div className="auth-field">
                <label htmlFor="auth-modal-email">{t("auth.email")}</label>
                <input
                  ref={inputRef}
                  id="auth-modal-email"
                  type="email"
                  required
                  value={state.email}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })
                  }
                />
              </div>
              <div className="auth-field">
                <label htmlFor="auth-modal-password">{t("auth.password")}</label>
                <input
                  id="auth-modal-password"
                  type="password"
                  required
                  value={state.password}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })
                  }
                />
              </div>
              {state.error && (
                <p className="auth-error" role="alert">
                  {state.error}
                </p>
              )}
              <button className="auth-modal__submit" type="submit" disabled={state.loading}>
                {state.loading ? t("common.loading") : t("auth.login")}
              </button>
            </form>
          )}

          {showPassphrase && (
            <form className="auth-modal__form" onSubmit={handlePassphraseSubmit}>
              <div className="auth-field">
                <label htmlFor="auth-modal-passphrase">{t("auth.passphrase")}</label>
                <input
                  ref={showCredentials ? undefined : inputRef}
                  id="auth-modal-passphrase"
                  type="password"
                  required
                  value={state.passphrase}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "passphrase", value: e.target.value })
                  }
                  data-1p-ignore
                />
              </div>
              {currentHint && (
                <div className="auth-modal__hint" data-testid="auth-modal-hint">
                  <span className="auth-modal__hint-label">{t("auth.hintLabel")}</span>
                  <span className="auth-modal__hint-text">{currentHint}</span>
                </div>
              )}
              {state.error && (
                <p className="auth-error" role="alert">
                  {state.error}
                </p>
              )}
              <button
                className="auth-modal__submit"
                type="submit"
                disabled={state.loading || !currentSalt}
              >
                {state.migrating
                  ? t("auth.migratingData")
                  : state.loading
                    ? t("auth.derivingKey")
                    : unlockLabel}
              </button>
            </form>
          )}

          <button type="button" className="auth-modal__logout" onClick={onLogout}>
            {t("auth.switchAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
