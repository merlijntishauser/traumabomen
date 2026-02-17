import { Github, Heart, Lock, ShieldCheck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import "../styles/footer.css";

const resources: Record<string, { name: string; url: string }> = {
  nl: { name: "Wij zijn Mind", url: "https://wijzijnmind.nl" },
  en: { name: "Crisis Text Line", url: "https://www.crisistextline.org" },
};

interface Props {
  onLock?: () => void;
}

export function AppFooter({ onLock }: Props) {
  const { t, i18n } = useTranslation();
  const resource = resources[i18n.language] ?? resources.en;

  return (
    <footer className="app-footer">
      <span className="app-footer__disclaimer">
        <Heart
          size={12}
          fill="currentColor"
          strokeWidth={0}
          className="app-footer__heart-icon"
          aria-hidden="true"
        />
        <span className="app-footer__disclaimer-full">{t("safety.footer.disclaimer")}</span>
        <span className="app-footer__disclaimer-short">{t("safety.footer.disclaimerShort")}</span>
      </span>

      <span className="app-footer__support">
        <Trans
          i18nKey="mentalHealth.footer"
          components={{
            a: (
              // biome-ignore lint/a11y/useAnchorContent: Trans injects children at runtime
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="app-footer__link"
                aria-label={resource.name}
              />
            ),
          }}
          values={{ resource: resource.name }}
        />
      </span>

      <div className="app-footer__actions">
        {onLock && (
          <button
            type="button"
            className="app-footer__btn app-footer__lock-btn"
            onClick={onLock}
            aria-label={t("safety.footer.lock")}
            title={t("safety.footer.lock")}
          >
            <Lock size={12} aria-hidden="true" />
          </button>
        )}
        <Link
          to="/privacy"
          className="app-footer__link"
          aria-label={t("safety.footer.privacy")}
          title={t("safety.footer.privacy")}
        >
          <ShieldCheck size={12} aria-hidden="true" />
        </Link>
        <a
          className="app-footer__link"
          href="https://github.com/merlijntishauser/traumabomen"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <Github size={14} />
        </a>
        <button
          type="button"
          className="app-footer__btn"
          onClick={() => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl")}
        >
          {i18n.language === "nl" ? "EN" : "NL"}
        </button>
        <ThemeToggle className="app-footer__btn" />
      </div>
    </footer>
  );
}
