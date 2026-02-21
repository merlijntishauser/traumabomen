import { useTranslation } from "react-i18next";
import type { TimelineSettings } from "../../hooks/useTimelineSettings";
import { ThemeLanguageSettings } from "./ThemeLanguageSettings";

interface Props {
  settings: TimelineSettings;
  onUpdate: (partial: Partial<TimelineSettings>) => void;
}

export function TimelineSettingsContent({ settings, onUpdate }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("timeline.viewSettings")}</span>
      </div>

      <label className="settings-panel__toggle">
        <input
          type="checkbox"
          checked={settings.showPartnerLines}
          onChange={(e) => onUpdate({ showPartnerLines: e.target.checked })}
        />
        <span>{t("timeline.showPartnerLines")}</span>
      </label>

      <label className="settings-panel__toggle">
        <input
          type="checkbox"
          checked={settings.showPartnerLabels}
          disabled={!settings.showPartnerLines}
          onChange={(e) => onUpdate({ showPartnerLabels: e.target.checked })}
        />
        <span>{t("timeline.showPartnerLabels")}</span>
      </label>

      <label className="settings-panel__toggle">
        <input
          type="checkbox"
          checked={settings.showClassifications}
          onChange={(e) => onUpdate({ showClassifications: e.target.checked })}
        />
        <span>{t("timeline.showClassifications")}</span>
      </label>

      <label className="settings-panel__toggle">
        <input
          type="checkbox"
          checked={settings.showGridlines}
          onChange={(e) => onUpdate({ showGridlines: e.target.checked })}
        />
        <span>{t("timeline.showGridlines")}</span>
      </label>

      <label className="settings-panel__toggle">
        <input
          type="checkbox"
          checked={settings.showMarkerLabels}
          onChange={(e) => onUpdate({ showMarkerLabels: e.target.checked })}
        />
        <span>{t("timeline.showMarkerLabels")}</span>
      </label>

      <div className="settings-panel__divider" />

      <ThemeLanguageSettings />
    </>
  );
}
