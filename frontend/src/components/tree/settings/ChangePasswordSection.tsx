import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { changePassword } from "../../../lib/api";
import { getPasswordStrength } from "../../../lib/passwordStrength";
import { PasswordStrengthMeter } from "../../PasswordStrengthMeter";

interface PasswordState {
  current: string;
  newPw: string;
  confirm: string;
  message: { type: "success" | "error"; text: string } | null;
  loading: boolean;
}

type PasswordAction =
  | { type: "SET_FIELD"; field: "current" | "newPw" | "confirm"; value: string }
  | { type: "SET_MESSAGE"; message: PasswordState["message"] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "RESET_FIELDS" };

const passwordInitialState: PasswordState = {
  current: "",
  newPw: "",
  confirm: "",
  message: null,
  loading: false,
};

function passwordReducer(state: PasswordState, action: PasswordAction): PasswordState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "RESET_FIELDS":
      return { ...state, current: "", newPw: "", confirm: "" };
  }
}

export function ChangePasswordSection() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(passwordReducer, passwordInitialState);

  async function handleChangePassword() {
    dispatch({ type: "SET_MESSAGE", message: null });
    if (state.newPw !== state.confirm) {
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "error", text: t("account.passwordMismatch") },
      });
      return;
    }
    if (getPasswordStrength(state.newPw).level === "weak") {
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "error", text: t("auth.passwordTooWeak") },
      });
      return;
    }
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      await changePassword({ current_password: state.current, new_password: state.newPw });
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "success", text: t("account.passwordChanged") },
      });
      dispatch({ type: "RESET_FIELDS" });
    } catch {
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "error", text: t("account.passwordError") },
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("account.changePassword")}</h4>
      {state.message && (
        <div className={`settings-panel__message settings-panel__message--${state.message.type}`}>
          {state.message.text}
        </div>
      )}
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.currentPassword")}
        value={state.current}
        onChange={(e) => dispatch({ type: "SET_FIELD", field: "current", value: e.target.value })}
        autoComplete="current-password"
      />
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.newPassword")}
        value={state.newPw}
        maxLength={64}
        onChange={(e) => dispatch({ type: "SET_FIELD", field: "newPw", value: e.target.value })}
        autoComplete="new-password"
      />
      <PasswordStrengthMeter password={state.newPw} />
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.confirmNewPassword")}
        value={state.confirm}
        onChange={(e) => dispatch({ type: "SET_FIELD", field: "confirm", value: e.target.value })}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="settings-panel__btn"
        disabled={
          !state.current ||
          !state.newPw ||
          !state.confirm ||
          state.loading ||
          getPasswordStrength(state.newPw).level === "weak"
        }
        onClick={handleChangePassword}
      >
        {t("common.save")}
      </button>
    </div>
  );
}
