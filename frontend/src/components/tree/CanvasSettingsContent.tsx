import { useTranslation } from "react-i18next";
import type { CanvasSettings, EdgeStyle } from "../../hooks/useCanvasSettings";
import { ThemeLanguageSettings } from "./ThemeLanguageSettings";

const EDGE_STYLES: EdgeStyle[] = ["curved", "elbows", "straight"];

interface Props {
  settings: CanvasSettings;
  onUpdate: (partial: Partial<CanvasSettings>) => void;
}

export function CanvasSettingsContent({ settings, onUpdate }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("canvas.gridSettings")}</span>
      </div>

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
        <span className="settings-panel__label">{t("canvas.other")}</span>
      </div>

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

      <div className="settings-panel__divider" />

      <ThemeLanguageSettings />
    </>
  );
}
