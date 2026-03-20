import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { PasswordInput } from "../components/PasswordInput";
import { ApiError, resetPassword } from "../lib/api";
import "../styles/auth.css";

interface ResetState {
  password: string;
  confirm: string;
  loading: boolean;
  success: boolean;
  error: string;
}

type ResetAction =
  | { type: "SET_PASSWORD"; value: string }
  | { type: "SET_CONFIRM"; value: string }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_SUCCESS" };

const initialState: ResetState = {
  password: "",
  confirm: "",
  loading: false,
  success: false,
  error: "",
};

function resetReducer(state: ResetState, action: ResetAction): ResetState {
  switch (action.type) {
    case "SET_PASSWORD":
      return { ...state, password: action.value };
    case "SET_CONFIRM":
      return { ...state, confirm: action.value };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_SUCCESS":
      return { ...state, success: true };
  }
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, dispatch] = useReducer(resetReducer, initialState);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });

    if (state.password !== state.confirm) {
      dispatch({ type: "SET_ERROR", error: t("auth.newPasswordMismatch") });
      return;
    }

    dispatch({ type: "SET_LOADING", loading: true });
    try {
      await resetPassword({ token: token!, new_password: state.password });
      dispatch({ type: "SET_SUCCESS" });
    } catch (err) {
      if (err instanceof ApiError && err.detail === "invalid_or_expired_token") {
        dispatch({ type: "SET_ERROR", error: t("auth.resetPasswordFailed") });
      } else if (err instanceof ApiError && err.detail === "password_too_weak") {
        dispatch({ type: "SET_ERROR", error: t("auth.passwordTooWeak") });
      } else {
        dispatch({ type: "SET_ERROR", error: t("common.error") });
      }
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  if (!token) {
    return (
      <div className="auth-page auth-page--centered">
        <AuthHero />
        <div className="auth-content">
          <div className="auth-card">
            <h2>{t("auth.resetPasswordTitle")}</h2>
            <p className="auth-error" role="alert">
              {t("auth.resetPasswordFailed")}
            </p>
            <p className="auth-footer">
              <Link to="/forgot-password">{t("auth.requestNewReset")}</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page auth-page--centered">
      <AuthHero />
      <div className="auth-content">
        <div className="auth-card">
          <h2>{t("auth.resetPasswordTitle")}</h2>

          {state.success ? (
            <>
              <p className="auth-success">{t("auth.resetPasswordSuccess")}</p>
              <Link
                to="/login"
                className="auth-submit"
                style={{ display: "block", textAlign: "center" }}
              >
                {t("auth.login")}
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-step-intro">{t("auth.resetPasswordNote")}</p>

              <div className="auth-field">
                <label htmlFor="new-password">{t("auth.newPassword")}</label>
                <PasswordInput
                  id="new-password"
                  required
                  value={state.password}
                  onChange={(e) => dispatch({ type: "SET_PASSWORD", value: e.target.value })}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirm-password">{t("auth.confirmNewPassword")}</label>
                <PasswordInput
                  id="confirm-password"
                  required
                  value={state.confirm}
                  onChange={(e) => dispatch({ type: "SET_CONFIRM", value: e.target.value })}
                />
              </div>

              {state.error && (
                <p className="auth-error" role="alert">
                  {state.error}
                </p>
              )}

              <button className="auth-submit" type="submit" disabled={state.loading}>
                {state.loading ? t("common.loading") : t("auth.resetPassword")}
              </button>
            </form>
          )}

          <p className="auth-footer">
            <Link to="/login">{t("auth.backToLogin")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
