import { Heart, Lock, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getAccessToken } from "../lib/api";
import { FeedbackModal } from "./FeedbackModal";
import { ThemeToggle } from "./ThemeToggle";
import "../styles/footer.css";

const T_FEEDBACK = "feedback.button";

const resources: Record<string, { name: string; url: string }> = {
  nl: { name: "Wij zijn Mind", url: "https://wijzijnmind.nl" },
  en: { name: "Crisis Text Line", url: "https://www.crisistextline.org" },
};

interface Props {
  onLock?: () => void;
}

export function AppFooter({ onLock }: Props) {
  const { t, i18n } = useTranslation();
  const [showFeedback, setShowFeedback] = useState(false);
  const isAuthenticated = !!getAccessToken();
  const resource = resources[i18n.language] ?? resources.en;

  const year = new Date().getFullYear();

  return (
    <>
      <footer className="app-footer">
        <div className="app-footer__row">
          <span className="app-footer__disclaimer">
            <Heart
              size={12}
              fill="currentColor"
              strokeWidth={0}
              className="app-footer__heart-icon"
              aria-hidden="true"
            />
            <span className="app-footer__disclaimer-full">{t("safety.footer.disclaimer")}</span>
            <span className="app-footer__disclaimer-short">
              {t("safety.footer.disclaimerShort")}
            </span>
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
                className="app-footer__btn"
                onClick={onLock}
                aria-label={t("safety.footer.lock")}
                title={t("safety.footer.lock")}
              >
                <Lock size={14} aria-hidden="true" />
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                className="app-footer__btn app-footer__btn--feedback"
                onClick={() => setShowFeedback(true)}
                aria-label={t(T_FEEDBACK)}
                title={t(T_FEEDBACK)}
              >
                <MessageSquare size={14} aria-hidden="true" />
                <span>{t(T_FEEDBACK)}</span>
              </button>
            )}
            <button
              type="button"
              className="app-footer__btn"
              onClick={() => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl")}
            >
              {i18n.language === "nl" ? "EN" : "NL"}
            </button>
            <ThemeToggle className="app-footer__btn" />
          </div>
        </div>

        <div className="app-footer__colophon">
          <span>&copy; {year} Merlijn Tishauser</span>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <a
            href="https://github.com/merlijntishauser/traumabomen/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            AGPL-3.0
          </a>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <Link to="/privacy">{t("nav.privacy")}</Link>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <a
            href="https://github.com/merlijntishauser/traumabomen"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {(__APP_VERSION__ || __APP_COMMIT__) && (
            <>
              <span className="app-footer__colophon-sep" aria-hidden="true" />
              <span className="app-footer__version">
                {__APP_VERSION__ && <span>{__APP_VERSION__}</span>}
                {__APP_VERSION__ && __APP_COMMIT__ && " "}
                {__APP_COMMIT__ && <span>({__APP_COMMIT__})</span>}
              </span>
            </>
          )}
        </div>
      </footer>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
}
