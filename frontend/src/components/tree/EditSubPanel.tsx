import { useState } from "react";
import { useTranslation } from "react-i18next";

interface EditSubPanelProps {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
}

export function EditSubPanel({
  title,
  onBack,
  onSave,
  onDelete,
  deleteLabel,
  children,
}: EditSubPanelProps) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resolvedDeleteLabel = deleteLabel ?? t("common.delete");
  const hasFooter = onSave != null || onDelete != null;

  function handleDelete() {
    if (confirmDelete) {
      onDelete?.();
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="detail-panel__sub-panel">
      <div className="detail-panel__sub-header">
        <span className="detail-panel__sub-title">{title}</span>
        <button
          type="button"
          className="detail-panel__close"
          onClick={onBack}
          aria-label={t("common.close")}
        >
          {t("common.cancel")}
        </button>
      </div>

      <div className="detail-panel__sub-body">{children}</div>

      {hasFooter && (
        <div className="detail-panel__sub-footer">
          {onSave && (
            <button
              type="button"
              className="detail-panel__btn detail-panel__btn--primary"
              onClick={onSave}
            >
              {t("common.save")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="detail-panel__btn detail-panel__btn--danger"
              onClick={handleDelete}
            >
              {confirmDelete ? `${resolvedDeleteLabel}?` : resolvedDeleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
