// The guest page's i18n: translations bundled in (no /locales/ request) and a
// language picked without i18next-browser-languagedetector, which caches its
// choice in localStorage and cookies. The guest page writes no storage at all.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../public/locales/en/translation.json";
import nl from "../../public/locales/nl/translation.json";
import { htmlLangFor } from "../lib/documentLanguage";
import { detectGuestLanguage, pageTitleFor } from "./guestLanguage";

const language = detectGuestLanguage(
  window.location.hostname,
  navigator.languages?.length ? navigator.languages : [navigator.language],
);

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, nl: { translation: nl } },
  lng: language,
  fallbackLng: "en",
  supportedLngs: ["en", "nl"],
  interpolation: {
    escapeValue: false,
  },
});

function applyDocumentLanguage(next: string) {
  document.documentElement.lang = htmlLangFor(next);
  document.title = pageTitleFor(next);
}

applyDocumentLanguage(language);
i18n.on("languageChanged", applyDocumentLanguage);
