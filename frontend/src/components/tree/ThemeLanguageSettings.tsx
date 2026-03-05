import { useTranslation } from "react-i18next";
import { useAvailableThemes } from "../../hooks/useAvailableThemes";
import { useTheme } from "../../hooks/useTheme";

export function ThemeLanguageSettings() {
  const { t, i18n } = useTranslation();
  const availableThemes = useAvailableThemes();
  const { theme, setTheme } = useTheme(availableThemes);

  return (
    <>
      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("settings.theme")}</span>
        <div className="settings-panel__radios">
          {availableThemes.map((t_theme) => (
            <label key={t_theme} className="settings-panel__radio">
              <input
                type="radio"
                name="theme"
                value={t_theme}
                checked={theme === t_theme}
                onChange={() => setTheme(t_theme)}
              />
              <span>{t(`settings.theme.${t_theme}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("settings.language")}</span>
        <div className="settings-panel__radios">
          <label className="settings-panel__radio">
            <input
              type="radio"
              name="language"
              value="en"
              checked={i18n.language === "en"}
              onChange={() => i18n.changeLanguage("en")}
            />
            <span>English</span>
          </label>
          <label className="settings-panel__radio">
            <input
              type="radio"
              name="language"
              value="nl"
              checked={i18n.language === "nl"}
              onChange={() => i18n.changeLanguage("nl")}
            />
            <span>Nederlands</span>
          </label>
        </div>
      </div>
    </>
  );
}
