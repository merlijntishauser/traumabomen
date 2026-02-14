import { useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "traumabomen-mobile-dismissed";

function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

export function MobileBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );

  if (dismissed || !isMobile()) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mobile-banner">
      <span>{t("common.mobileWarning")}</span>
      <button className="mobile-banner__close" onClick={handleDismiss} aria-label={t("common.close")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
