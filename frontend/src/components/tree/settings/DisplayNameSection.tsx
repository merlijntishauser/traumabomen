import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { getProfile, updateProfile } from "../../../lib/api";

const MAX_LENGTH = 100;

interface NameState {
  name: string;
  savedName: string;
  loading: boolean;
  saving: boolean;
  success: boolean;
  error: boolean;
}

type NameAction =
  | { type: "LOADED"; name: string }
  | { type: "LOAD_FAILED" }
  | { type: "SET_NAME"; name: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; savedName: string }
  | { type: "SAVE_ERROR" };

const initialState: NameState = {
  name: "",
  savedName: "",
  loading: true,
  saving: false,
  success: false,
  error: false,
};

function nameReducer(state: NameState, action: NameAction): NameState {
  switch (action.type) {
    case "LOADED":
      return { ...state, name: action.name, savedName: action.name, loading: false };
    case "LOAD_FAILED":
      return { ...state, loading: false };
    case "SET_NAME":
      return { ...state, name: action.name, success: false };
    case "SAVE_START":
      return { ...state, saving: true, error: false, success: false };
    case "SAVE_SUCCESS":
      return { ...state, saving: false, savedName: action.savedName, success: true };
    case "SAVE_ERROR":
      return { ...state, saving: false, error: true };
  }
}

/** Optional display name, stored without encryption and shown to the people you share a tree with. */
export function DisplayNameSection() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(nameReducer, initialState);

  useEffect(() => {
    getProfile()
      .then((res) => dispatch({ type: "LOADED", name: res.display_name ?? "" }))
      .catch(() => dispatch({ type: "LOAD_FAILED" }));
  }, []);

  async function handleSave() {
    dispatch({ type: "SAVE_START" });
    const trimmed = state.name.trim();
    try {
      await updateProfile(trimmed || null);
      dispatch({ type: "SAVE_SUCCESS", savedName: trimmed });
    } catch {
      dispatch({ type: "SAVE_ERROR" });
    }
  }

  if (state.loading) return null;

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("account.displayName")}</h4>
      <p className="settings-panel__description">{t("account.displayNameHelp")}</p>
      <input
        type="text"
        className="settings-panel__input"
        value={state.name}
        onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
        maxLength={MAX_LENGTH}
        placeholder={t("account.displayNamePlaceholder")}
        aria-label={t("account.displayName")}
      />
      {state.error && <p className="auth-error">{t("account.displayNameError")}</p>}
      {state.success && <p className="auth-success">{t("account.displayNameSaved")}</p>}
      <button
        type="button"
        className="settings-panel__btn"
        onClick={handleSave}
        disabled={state.saving || state.name.trim() === state.savedName}
      >
        {state.saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
}
