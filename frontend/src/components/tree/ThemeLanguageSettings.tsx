import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";

export function ThemeLanguageSettings() {
  const { t, i18n } = useTranslation();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <>
      <div className="settings-panel__group">
        <span className="settings-panel__label">{t("settings.theme")}</span>
      </div>
      <div className="settings-panel__theme-row">
        <Sun size={14} className="settings-panel__theme-icon" />
        <button
          type="button"
          role="switch"
          aria-checked={theme === "dark"}
          aria-label={t("settings.theme")}
          className={`settings-panel__theme-switch ${theme === "dark" ? "settings-panel__theme-switch--dark" : ""}`}
          onClick={toggleTheme}
        >
          <span className="settings-panel__theme-knob" />
        </button>
        <Moon size={14} className="settings-panel__theme-icon" />
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
