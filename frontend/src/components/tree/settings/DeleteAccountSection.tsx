import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useLogout } from "../../../hooks/useLogout";
import { deleteAccount } from "../../../lib/api";

interface DeleteAccountState {
  expanded: boolean;
  confirmText: string;
  password: string;
  message: { type: "success" | "error"; text: string } | null;
  loading: boolean;
}

type DeleteAccountAction =
  | { type: "SET_FIELD"; field: "confirmText" | "password"; value: string }
  | { type: "SET_EXPANDED"; expanded: boolean }
  | { type: "SET_MESSAGE"; message: DeleteAccountState["message"] }
  | { type: "SET_LOADING"; loading: boolean };

const deleteAccountInitialState: DeleteAccountState = {
  expanded: false,
  confirmText: "",
  password: "",
  message: null,
  loading: false,
};

function deleteAccountReducer(
  state: DeleteAccountState,
  action: DeleteAccountAction,
): DeleteAccountState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_EXPANDED":
      return { ...state, expanded: action.expanded };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
  }
}

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const logout = useLogout();

  const [state, dispatch] = useReducer(deleteAccountReducer, deleteAccountInitialState);

  async function handleDeleteAccount() {
    dispatch({ type: "SET_MESSAGE", message: null });
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      await deleteAccount({ password: state.password });
      logout();
    } catch {
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "error", text: t("account.deleteError") },
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  return (
    <div className="settings-panel__section settings-panel__section--danger">
      <h4 className="settings-panel__section-title">{t("account.deleteAccount")}</h4>
      {!state.expanded ? (
        <button
          type="button"
          className="settings-panel__btn settings-panel__btn--danger"
          onClick={() => dispatch({ type: "SET_EXPANDED", expanded: true })}
        >
          {t("account.deleteAccount")}
        </button>
      ) : (
        <div className="settings-panel__delete-confirm">
          <div className="settings-panel__warning">{t("account.deleteWarning")}</div>
          {state.message && (
            <div
              className={`settings-panel__message settings-panel__message--${state.message.type}`}
            >
              {state.message.text}
            </div>
          )}
          <input
            type="text"
            className="settings-panel__input"
            placeholder={t("account.deleteConfirmLabel")}
            value={state.confirmText}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "confirmText", value: e.target.value })
            }
          />
          <input
            type="password"
            className="settings-panel__input"
            placeholder={t("account.deletePassword")}
            value={state.password}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })
            }
            autoComplete="current-password"
          />
          <button
            type="button"
            className="settings-panel__btn settings-panel__btn--danger"
            disabled={state.confirmText !== "DELETE" || !state.password || state.loading}
            onClick={handleDeleteAccount}
          >
            {t("account.deleteButton")}
          </button>
        </div>
      )}
    </div>
  );
}
