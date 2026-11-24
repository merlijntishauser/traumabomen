import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./RemoveSharedTreeConfirm.css";

interface Props {
  ownerLabel: string;
  busy: boolean;
  /** A translation key, ready for t(). */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Id of the title, so a surrounding dialog can be labelled by it. */
  titleId: string;
  className?: string;
}

/** Asks before a shared tree leaves the recipient's list. Starts on Cancel, the safe choice. */
export function RemoveSharedTreeConfirm({
  ownerLabel,
  busy,
  error,
  onConfirm,
  onCancel,
  titleId,
  className,
}: Props) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <section
      className={className ? `remove-shared ${className}` : "remove-shared"}
      aria-labelledby={titleId}
    >
      <p id={titleId} className="remove-shared__title">
        {t("share.removeFromListTitle")}
      </p>
      <p className="remove-shared__body">{t("share.removeFromListBody", { owner: ownerLabel })}</p>
      {error && (
        <p className="remove-shared__error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="remove-shared__actions">
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
          {t("share.removeFromListConfirm")}
        </button>
        <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </section>
  );
}
