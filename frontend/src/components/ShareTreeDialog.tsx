import { Eye, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useTreeShares } from "../hooks/useTreeShares";
import type { ShareResponse } from "../types/api";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import "./ShareTreeDialog.css";

interface Props {
  treeId: string;
  treeName: string;
  onClose: () => void;
}

interface ShareDialogState {
  email: string;
  /** The address awaiting the owner's confirmation to be invited. */
  inviteFor: string | null;
  busy: boolean;
  error: string | null;
}

type ShareDialogAction =
  | { type: "SET_EMAIL"; email: string }
  | { type: "START" }
  | { type: "NEEDS_INVITE"; email: string }
  | { type: "CANCEL_INVITE" }
  | { type: "DONE" }
  | { type: "FAILED"; error: string };

const initialState: ShareDialogState = { email: "", inviteFor: null, busy: false, error: null };

function reducer(state: ShareDialogState, action: ShareDialogAction): ShareDialogState {
  switch (action.type) {
    case "SET_EMAIL":
      return { ...state, email: action.email, inviteFor: null, error: null };
    case "START":
      return { ...state, busy: true, error: null };
    case "NEEDS_INVITE":
      return { ...state, busy: false, inviteFor: action.email };
    case "CANCEL_INVITE":
      return { ...state, inviteFor: null };
    case "DONE":
      return { ...initialState };
    case "FAILED":
      return { ...state, busy: false, inviteFor: null, error: action.error };
  }
}

function ShareRow({ share, onRemove }: { share: ShareResponse; onRemove: (id: string) => void }) {
  const { t } = useTranslation();
  const active = share.status === "active";
  return (
    <li className="share-dialog__row">
      <div className="share-dialog__who">
        {/* A pending share is only an invitation: show the address, never a name. */}
        <span className="share-dialog__name">
          {active ? (share.recipient_display_name ?? share.recipient_email) : share.recipient_email}
        </span>
        <span className="share-dialog__status">
          {active && <Eye size={13} aria-hidden="true" />}
          {t(active ? "share.statusActive" : "share.statusPending")}
        </span>
      </div>
      <ConfirmDeleteButton
        className="share-dialog__remove"
        label={t("share.removeAccess")}
        confirmLabel={t("share.removeConfirm")}
        onConfirm={() => onRemove(share.id)}
      />
    </li>
  );
}

export function ShareTreeDialog({ treeId, treeName, onClose }: Props) {
  const { t } = useTranslation();
  const { shares, isLoading, isError, share, remove } = useTreeShares(treeId);
  const [state, dispatch] = useReducer(reducer, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleClose = useCallback(() => {
    if (!state.busy) onClose();
  }, [state.busy, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    function handleBackdropClick(e: MouseEvent) {
      if (e.target === dialog) handleClose();
    }
    dialog.addEventListener("click", handleBackdropClick);
    return () => dialog.removeEventListener("click", handleBackdropClick);
  }, [handleClose]);

  async function submit(email: string, invite: boolean) {
    dispatch({ type: "START" });
    const outcome = await share(email, { invite });
    if ("ok" in outcome) dispatch({ type: "DONE" });
    else if ("needsInvite" in outcome) dispatch({ type: "NEEDS_INVITE", email });
    else dispatch({ type: "FAILED", error: outcome.error });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state.email.trim() || state.busy) return;
    void submit(state.email, false);
  }

  async function handleRemove(shareId: string) {
    const outcome = await remove(shareId);
    if ("error" in outcome) dispatch({ type: "FAILED", error: outcome.error });
  }

  return createPortal(
    <dialog
      className="share-dialog"
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      aria-label={t("share.title", { name: treeName })}
    >
      <div className="share-dialog__card">
        <button
          type="button"
          className="share-dialog__close"
          onClick={handleClose}
          aria-label={t("common.close")}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <h2 className="share-dialog__title">{t("share.title", { name: treeName })}</h2>

        <form className="share-dialog__form" onSubmit={handleSubmit}>
          <label className="share-dialog__label" htmlFor="share-email">
            {t("share.emailLabel")}
          </label>
          <div className="share-dialog__field">
            <input
              id="share-email"
              type="email"
              autoComplete="off"
              className="share-dialog__input"
              value={state.email}
              onChange={(e) => dispatch({ type: "SET_EMAIL", email: e.target.value })}
              placeholder={t("share.emailPlaceholder")}
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!state.email.trim() || state.busy}
            >
              {state.busy ? t("share.sharing") : t("share.submit")}
            </button>
          </div>
        </form>

        {state.inviteFor && (
          <div className="share-dialog__invite" role="alert">
            <p>{t("share.inviteConfirm", { email: state.inviteFor })}</p>
            <p className="share-dialog__invite-note">{t("share.inviteWaitlistNote")}</p>
            <div className="share-dialog__invite-actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={state.busy}
                onClick={() => void submit(state.inviteFor ?? "", true)}
              >
                {t("share.inviteSend")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: "CANCEL_INVITE" })}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

        {state.error && (
          <p className="share-dialog__error" role="alert">
            {t(state.error)}
          </p>
        )}

        <h3 className="share-dialog__subtitle">{t("share.listTitle")}</h3>
        {isLoading ? (
          <p className="share-dialog__empty">{t("common.loading")}</p>
        ) : isError ? (
          <p className="share-dialog__error" role="alert">
            {t("share.listError")}
          </p>
        ) : shares.length === 0 ? (
          <p className="share-dialog__empty">{t("share.empty")}</p>
        ) : (
          <ul className="share-dialog__list">
            {shares.map((s) => (
              <ShareRow key={s.id} share={s} onRemove={(id) => void handleRemove(id)} />
            ))}
          </ul>
        )}

        <p className="share-dialog__depth">{t("share.depth")}</p>
      </div>
    </dialog>,
    document.body,
  );
}
