import { Droplets, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Theme } from "../hooks/useAvailableThemes";
import { useAvailableThemes } from "../hooks/useAvailableThemes";
import { useTheme } from "../hooks/useTheme";

const icons: Record<Theme, typeof Sun> = {
  dark: Sun,
  light: Moon,
  watercolor: Droplets,
};

export function ThemeToggle({ className }: { className?: string }) {
  const availableThemes = useAvailableThemes();
  const { theme, toggle } = useTheme(availableThemes);
  const { t } = useTranslation();
  const Icon = icons[theme];

  return (
    <button type="button" onClick={toggle} className={className} aria-label={t("theme.toggle")}>
      <Icon size={16} />
    </button>
  );
}
