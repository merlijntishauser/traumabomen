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
  // On phones the toggles and links collapse into a vertical menu that opens
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

  const closeMenu = () => setMenuOpen(false);
  const toggleLanguage = () => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl");
  // The genogram landing page is language-fixed with a path per language.
  const genogramPath = i18n.language === "nl" ? "/genogram-maken" : "/genogram";

  const version = (__APP_VERSION__ || __APP_COMMIT__) && (
    <span className="app-footer__version">
      {__APP_VERSION__ && <span>{__APP_VERSION__}</span>}
      {__APP_VERSION__ && __APP_COMMIT__ && " "}
      {__APP_COMMIT__ && <span>({__APP_COMMIT__})</span>}
    </span>
  );

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
            aria-haspopup="true"
            aria-controls="app-footer-menu"
            aria-label={t("safety.footer.menu")}
          >
            {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>

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
            <button type="button" className="app-footer__btn" onClick={toggleLanguage}>
              {i18n.language === "nl" ? "EN" : "NL"}
            </button>
            <ThemeToggle className="app-footer__btn" />
          </div>
        </div>

        <div className="app-footer__colophon">
          <span>&copy; {year} Merlijn Tishauser</span>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
            AGPL-3.0
          </a>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <Link to="/privacy">{t("nav.privacy")}</Link>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <Link to="/learn">{t("nav.learn")}</Link>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <Link to={genogramPath}>{t("nav.genogram")}</Link>
          <span className="app-footer__colophon-sep" aria-hidden="true" />
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {version && <span className="app-footer__colophon-sep" aria-hidden="true" />}
          {version}
        </div>

        {menuOpen && (
          <div className="app-footer__menu" id="app-footer-menu" ref={menuRef}>
            <button
              type="button"
              className="app-footer__menu-item"
              onClick={() => {
                toggleLanguage();
                closeMenu();
              }}
            >
              {i18n.language === "nl" ? "English" : "Nederlands"}
            </button>
            <ThemeToggle
              className="app-footer__menu-item"
              label={t("theme.toggle")}
              onToggle={closeMenu}
            />
            {isAuthenticated && (
              <button
                type="button"
                className="app-footer__menu-item"
                onClick={() => {
                  setShowFeedback(true);
                  closeMenu();
                }}
              >
                {t(T_FEEDBACK)}
              </button>
            )}
            {onLock && (
              <button
                type="button"
                className="app-footer__menu-item"
                onClick={() => {
                  onLock();
                  closeMenu();
                }}
              >
                {t("safety.footer.lock")}
              </button>
            )}
            <Link className="app-footer__menu-item" to="/privacy" onClick={closeMenu}>
              {t("nav.privacy")}
            </Link>
            <Link className="app-footer__menu-item" to="/learn" onClick={closeMenu}>
              {t("nav.learn")}
            </Link>
            <Link className="app-footer__menu-item" to={genogramPath} onClick={closeMenu}>
              {t("nav.genogram")}
            </Link>
            <a
              className="app-footer__menu-item"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              GitHub
            </a>
            <a
              className="app-footer__menu-item"
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              AGPL-3.0
            </a>
            <div className="app-footer__menu-meta">
              <span>&copy; {year} Merlijn Tishauser</span>
              {version}
            </div>
          </div>
        )}
      </footer>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
}
