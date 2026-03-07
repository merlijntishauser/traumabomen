import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./ConfirmDeleteButton.css";

interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  label: string;
  confirmLabel: string;
  className?: string;
}

export function ConfirmDeleteButton({
  onConfirm,
  label,
  confirmLabel,
  className = "detail-panel__btn detail-panel__btn--danger",
}: ConfirmDeleteButtonProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 10000);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="confirm-delete">
      <span className="confirm-delete__label">{confirmLabel}</span>
      <span className="confirm-delete__actions">
        <button
          type="button"
          className="confirm-delete__btn confirm-delete__btn--confirm"
          onClick={onConfirm}
        >
          {label}
        </button>
        <button
          type="button"
          className="confirm-delete__btn confirm-delete__btn--cancel"
          onClick={() => setConfirming(false)}
        >
          {t("common.cancel")}
        </button>
      </span>
    </span>
  );
}
