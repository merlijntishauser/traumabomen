import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import "./MentalHealthBanner.css";

const STORAGE_KEY = "mentalHealthBannerDismissed";

const resources: Record<string, { name: string; url: string }> = {
  nl: { name: "Wij zijn Mind", url: "https://wijzijnmind.nl" },
  en: { name: "Crisis Text Line", url: "https://www.crisistextline.org" },
};

export function MentalHealthBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const { t, i18n } = useTranslation();

  if (dismissed) return null;

  const resource = resources[i18n.language] ?? resources.en;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mh-banner" role="alert">
      <p className="mh-banner__text">
        <Trans
          i18nKey="mentalHealth.banner"
          components={{
            a: (
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mh-banner__link"
              />
            ),
          }}
          values={{ resource: resource.name }}
        />
      </p>
      <button className="mh-banner__close" onClick={handleDismiss} aria-label={t("common.close")}>
        &times;
      </button>
    </div>
  );
}
