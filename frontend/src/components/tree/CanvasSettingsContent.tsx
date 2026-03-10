import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CanvasSettings, EdgeStyle } from "../../hooks/useCanvasSettings";
import { ThemeLanguageSettings } from "./ThemeLanguageSettings";

const EDGE_STYLES: EdgeStyle[] = ["curved", "elbows", "straight"];

interface Props {
  settings: CanvasSettings;
  onUpdate: (partial: Partial<CanvasSettings>) => void;
  onExportEncrypted?: () => Promise<void>;
  onExportPlaintext?: () => Promise<void>;
}

export function CanvasSettingsContent({
  settings,
  onUpdate,
  onExportEncrypted,
  onExportPlaintext,
}: Props) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [confirmPlaintext, setConfirmPlaintext] = useState(false);

  async function handleExportEncrypted() {
    if (!onExportEncrypted) return;
    setExporting(true);
    try {
      await onExportEncrypted();
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPlaintext() {
    if (!onExportPlaintext) return;
    setExporting(true);
    try {
      await onExportPlaintext();
    } finally {
      setExporting(false);
      setConfirmPlaintext(false);
    }
  }

  return (
    <>
      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("canvas.gridSettings")}</span>
      </div>

      <div className="settings-panel__toggle-grid">
        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(e) => onUpdate({ showGrid: e.target.checked })}
          />
          <span>{t("canvas.showGrid")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.snapToGrid}
            onChange={(e) => onUpdate({ snapToGrid: e.target.checked })}
          />
          <span>{t("canvas.snapToGrid")}</span>
        </label>
      </div>

      <div className="settings-panel__divider" />

      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("canvas.edgeStyle")}</span>
        <div className="settings-panel__radios">
          {EDGE_STYLES.map((style) => (
            <label key={style} className="settings-panel__radio">
              <input
                type="radio"
                name="edgeStyle"
                value={style}
                checked={settings.edgeStyle === style}
                onChange={() => onUpdate({ edgeStyle: style })}
              />
              <span>{t(`canvas.edgeStyle.${style}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-panel__divider" />

      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("canvas.relationshipVisibility")}</span>
      </div>

      <div className="settings-panel__toggle-grid">
        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showParentEdges}
            onChange={(e) => onUpdate({ showParentEdges: e.target.checked })}
          />
          <span>{t("canvas.showParentEdges")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showPartnerEdges}
            onChange={(e) => onUpdate({ showPartnerEdges: e.target.checked })}
          />
          <span>{t("canvas.showPartnerEdges")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showSiblingEdges}
            onChange={(e) => onUpdate({ showSiblingEdges: e.target.checked })}
          />
          <span>{t("canvas.showSiblingEdges")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showFriendEdges}
            onChange={(e) => onUpdate({ showFriendEdges: e.target.checked })}
          />
          <span>{t("canvas.showFriendEdges")}</span>
        </label>
      </div>

      <div className="settings-panel__divider" />

      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("canvas.other")}</span>
      </div>

      <div className="settings-panel__toggle-grid">
        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showMarkers}
            onChange={(e) => onUpdate({ showMarkers: e.target.checked })}
          />
          <span>{t("canvas.showMarkers")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showMinimap}
            onChange={(e) => onUpdate({ showMinimap: e.target.checked })}
          />
          <span>{t("canvas.showMinimap")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.promptRelationship}
            onChange={(e) => onUpdate({ promptRelationship: e.target.checked })}
          />
          <span>{t("canvas.promptRelationship")}</span>
        </label>

        <label className="settings-panel__toggle">
          <input
            type="checkbox"
            checked={settings.showReflectionPrompts}
            onChange={(e) => onUpdate({ showReflectionPrompts: e.target.checked })}
          />
          <span>{t("canvas.showReflectionPrompts")}</span>
        </label>
      </div>

      {(onExportEncrypted || onExportPlaintext) && (
        <>
          <div className="settings-panel__divider" />

          <div className="settings-panel__group">
            <span className="settings-panel__label">{t("export.title")}</span>
          </div>

          <div className="settings-panel__export-actions">
            {onExportEncrypted && (
              <button
                type="button"
                className="settings-panel__btn"
                onClick={handleExportEncrypted}
                disabled={exporting}
              >
                {t("export.downloadBackup")}
              </button>
            )}
            {onExportPlaintext && !confirmPlaintext && (
              <button
                type="button"
                className="settings-panel__btn"
                onClick={() => setConfirmPlaintext(true)}
                disabled={exporting}
              >
                {t("export.downloadPlaintext")}
              </button>
            )}
            {confirmPlaintext && (
              <div className="settings-panel__export-confirm">
                <div className="settings-panel__warning">{t("export.plaintextWarning")}</div>
                <div className="settings-panel__export-confirm-actions">
                  <button
                    type="button"
                    className="settings-panel__btn settings-panel__btn--danger"
                    onClick={handleExportPlaintext}
                    disabled={exporting}
                  >
                    {t("export.confirmDownload")}
                  </button>
                  <button
                    type="button"
                    className="settings-panel__btn"
                    onClick={() => setConfirmPlaintext(false)}
                    disabled={exporting}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="settings-panel__divider" />

      <ThemeLanguageSettings />
    </>
  );
}
