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
        <svg
          className="app-footer__heart-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
            </svg>
          </button>
        )}
        <Link
          to="/privacy"
          className="app-footer__link"
          aria-label={t("safety.footer.privacy")}
          title={t("safety.footer.privacy")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
          </svg>
        </Link>
        <a
          className="app-footer__link"
          href="https://github.com/merlijntishauser/traumabomen"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
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
