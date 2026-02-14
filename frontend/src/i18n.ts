import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/translation.json";
import nl from "./locales/nl/translation.json";

const hostnameDetector = {
  name: "hostname",
  lookup() {
    const host = window.location.hostname;
    if (host === "traumabomen.nl" || host.endsWith(".traumabomen.nl")) return "nl";
    if (host === "traumatrees.org" || host.endsWith(".traumatrees.org")) return "en";
    return undefined;
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(hostnameDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    fallbackLng: "en",
    detection: {
      order: ["hostname", "localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
