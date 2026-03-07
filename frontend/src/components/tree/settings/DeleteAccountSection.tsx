import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLogout } from "../../../hooks/useLogout";
import { deleteAccount } from "../../../lib/api";

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const logout = useLogout();

  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMessage, setDeleteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteAccount() {
    setDeleteMessage(null);
    setDeleteLoading(true);
    try {
      await deleteAccount({ password: deletePassword });
      logout();
    } catch {
      setDeleteMessage({ type: "error", text: t("account.deleteError") });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="settings-panel__section settings-panel__section--danger">
      <h4 className="settings-panel__section-title">{t("account.deleteAccount")}</h4>
      {!deleteExpanded ? (
        <button
          type="button"
          className="settings-panel__btn settings-panel__btn--danger"
          onClick={() => setDeleteExpanded(true)}
        >
          {t("account.deleteAccount")}
        </button>
      ) : (
        <div className="settings-panel__delete-confirm">
          <div className="settings-panel__warning">{t("account.deleteWarning")}</div>
          {deleteMessage && (
            <div
              className={`settings-panel__message settings-panel__message--${deleteMessage.type}`}
            >
              {deleteMessage.text}
            </div>
          )}
          <input
            type="text"
            className="settings-panel__input"
            placeholder={t("account.deleteConfirmLabel")}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <input
            type="password"
            className="settings-panel__input"
            placeholder={t("account.deletePassword")}
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="settings-panel__btn settings-panel__btn--danger"
            disabled={
              deleteConfirmText !== "DELETE" || !deletePassword || deleteLoading
            }
            onClick={handleDeleteAccount}
          >
            {t("account.deleteButton")}
          </button>
        </div>
      )}
    </div>
  );
}
