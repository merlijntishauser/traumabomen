import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "traumabomen-mobile-dismissed";

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

// The warning is only apt inside the authenticated app, where the tree canvas
// and admin dashboard are desktop-oriented. The public marketing and auth pages
// work well on mobile, so the banner would only contradict them there.
function isAppRoute(pathname: string): boolean {
  return /^\/(trees|admin)(\/|$)/.test(pathname);
}

export function MobileBanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  if (dismissed || !isAppRoute(pathname) || !isMobile()) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mobile-banner">
      <span>{t("common.mobileWarning")}</span>
      <button
        type="button"
        className="mobile-banner__close"
        onClick={handleDismiss}
        aria-label={t("common.close")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
