import { useTranslation } from "react-i18next";

interface EditSubPanelProps {
  title: string;
  onBack: () => void;
  /**
   * Label for the back control: "Close" when editing (autosave has already
   * persisted everything), "Cancel" when creating (backing out discards).
   */
  closeLabel?: string;
  children: React.ReactNode;
}

export function EditSubPanel({ title, onBack, closeLabel, children }: EditSubPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="detail-panel__sub-panel">
      <div className="detail-panel__sub-header">
        <span className="detail-panel__sub-title">{title}</span>
        <button
          type="button"
          className="panel-close"
          onClick={onBack}
          aria-label={t("common.close")}
        >
          {closeLabel ?? t("common.cancel")}
        </button>
      </div>

      <div className="detail-panel__sub-body">{children}</div>
    </div>
  );
}
