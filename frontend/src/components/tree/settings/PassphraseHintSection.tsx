import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { getEncryptionSalt, updatePassphraseHint } from "../../../lib/api";

interface HintState {
  hint: string;
  savedHint: string;
  loading: boolean;
  saving: boolean;
  success: boolean;
  error: string;
}

type HintAction =
  | { type: "LOADED"; hint: string }
  | { type: "LOAD_FAILED" }
  | { type: "SET_HINT"; hint: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; savedHint: string }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "SAVE_END" };

const hintInitialState: HintState = {
  hint: "",
  savedHint: "",
  loading: true,
  saving: false,
  success: false,
  error: "",
};

function hintReducer(state: HintState, action: HintAction): HintState {
  switch (action.type) {
    case "LOADED":
      return { ...state, hint: action.hint, savedHint: action.hint, loading: false };
    case "LOAD_FAILED":
      return { ...state, loading: false };
    case "SET_HINT":
      return { ...state, hint: action.hint, success: false };
    case "SAVE_START":
      return { ...state, saving: true, error: "", success: false };
    case "SAVE_SUCCESS":
      return { ...state, savedHint: action.savedHint, success: true };
    case "SAVE_ERROR":
      return { ...state, error: action.error };
    case "SAVE_END":
      return { ...state, saving: false };
  }
}

export function PassphraseHintSection() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(hintReducer, hintInitialState);

  useEffect(() => {
    getEncryptionSalt()
      .then((res) => {
        dispatch({ type: "LOADED", hint: res.passphrase_hint ?? "" });
      })
      .catch(() => dispatch({ type: "LOAD_FAILED" }));
  }, []);

  async function handleSave() {
    dispatch({ type: "SAVE_START" });
    try {
      const value = state.hint.trim() || null;
      await updatePassphraseHint(value);
      dispatch({ type: "SAVE_SUCCESS", savedHint: state.hint.trim() });
    } catch {
      dispatch({ type: "SAVE_ERROR", error: t("settings.hintError") });
    } finally {
      dispatch({ type: "SAVE_END" });
    }
  }

  const isDirty = state.hint !== state.savedHint;

  if (state.loading) return null;

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("settings.passphraseHint")}</h4>
      <p className="settings-panel__description">{t("settings.hintDescription")}</p>
      <input
        type="text"
        className="settings-panel__input"
        value={state.hint}
        onChange={(e) => dispatch({ type: "SET_HINT", hint: e.target.value })}
        maxLength={255}
        placeholder={t("auth.hintPlaceholder")}
      />
      {state.error && <p className="auth-error">{state.error}</p>}
      {state.success && <p className="auth-success">{t("settings.hintSaved")}</p>}
      <button
        type="button"
        className="settings-panel__btn"
        onClick={handleSave}
        disabled={state.saving || !isDirty}
      >
        {state.saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
}
