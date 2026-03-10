import { useTranslation } from "react-i18next";
import { useCanvasSettings } from "../../../hooks/useCanvasSettings";

export function AutoLockSection() {
  const { t } = useTranslation();
  const { settings, update } = useCanvasSettings();

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("settings.autoLockTimeout")}</h4>
      <select
        value={settings.autoLockMinutes}
        onChange={(e) => update({ autoLockMinutes: Number(e.target.value) })}
        aria-label={t("settings.autoLockTimeout")}
        className="settings-panel__input"
      >
        <option value={5}>{t("settings.autoLock5min")}</option>
        <option value={15}>{t("settings.autoLock15min")}</option>
        <option value={30}>{t("settings.autoLock30min")}</option>
        <option value={60}>{t("settings.autoLock60min")}</option>
        <option value={0}>{t("settings.autoLockDisabled")}</option>
      </select>
    </div>
  );
}
