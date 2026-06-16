import { Heart, Lock, Menu, MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const GITHUB_URL = "https://github.com/merlijntishauser/traumabomen";
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

interface Props {
  onLock?: () => void;
}

export function AppFooter({ onLock }: Props) {
  const { t, i18n } = useTranslation();
  const [showFeedback, setShowFeedback] = useState(false);
  // On phones the toggles and links collapse into a contextual menu that floats
  // above the bar; the safety line stays visible. Hidden on desktop.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const isAuthenticated = !!getAccessToken();
  const resource = resources[i18n.language] ?? resources.en;

  const year = new Date().getFullYear();

  // Close the menu on a click outside it or on Escape (contextual-menu behaviour).
  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggleLanguage = () => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl");

  // The action buttons (lock, feedback, language, theme). Shared by the desktop
  // row and the mobile menu; `onSelect` lets the menu close after a choice.
  const actions = (onSelect?: () => void) => (
    <div className="app-footer__actions">
      {onLock && (
        <button
          type="button"
          className="app-footer__btn"
          onClick={() => {
            onLock();
            onSelect?.();
          }}
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
          onClick={() => {
            setShowFeedback(true);
            onSelect?.();
          }}
          aria-label={t(T_FEEDBACK)}
          title={t(T_FEEDBACK)}
        >
          <MessageSquare size={14} aria-hidden="true" />
          <span>{t(T_FEEDBACK)}</span>
        </button>
      )}
      <button type="button" className="app-footer__btn" onClick={toggleLanguage}>
        {i18n.language === "nl" ? "EN" : "NL"}
      </button>
      <ThemeToggle className="app-footer__btn" />
    </div>
  );

  // The colophon links and copyright. `onNavigate` closes the mobile menu when a
  // link is followed so it does not linger over the next page.
  const colophon = (onNavigate?: () => void) => (
    <div className="app-footer__colophon">
      <span>&copy; {year} Merlijn Tishauser</span>
      <span className="app-footer__colophon-sep" aria-hidden="true" />
      <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
        AGPL-3.0
      </a>
      <span className="app-footer__colophon-sep" aria-hidden="true" />
      <Link to="/privacy" onClick={onNavigate}>
        {t("nav.privacy")}
      </Link>
      <span className="app-footer__colophon-sep" aria-hidden="true" />
      <Link to="/learn" onClick={onNavigate}>
        {t("nav.learn")}
      </Link>
      <span className="app-footer__colophon-sep" aria-hidden="true" />
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
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
  );

  const closeMenu = () => setMenuOpen(false);

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

          <button
            type="button"
            ref={toggleRef}
            className="app-footer__menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={t("safety.footer.menu")}
          >
            {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>

          {actions()}
        </div>

        {colophon()}

        {menuOpen && (
          <div className="app-footer__menu" role="menu" ref={menuRef}>
            {actions(closeMenu)}
            {colophon(closeMenu)}
          </div>
        )}
      </footer>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
}
