import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

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
  .use(HttpBackend)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "nl"],
    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },
    detection: {
      order: ["hostname", "localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
