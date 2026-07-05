import { createInstance } from "i18next";
import { renderToString } from "react-dom/server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import GenogramPage, { type GenogramLang } from "../pages/GenogramPage";
import { GENOGRAM_PATHS } from "./html";

export {
  fillPlaceholders,
  GENOGRAM_PATHS,
  genogramJsonLd,
  genogramPageMeta,
  injectJsonLd,
  injectRoot,
} from "./html";

export interface TranslationResources {
  en: Record<string, string>;
  nl: Record<string, string>;
}

/**
 * Render one genogram landing page to static HTML at build time.
 *
 * A dedicated i18next instance is created per render with inline resources
 * (the runtime instance in src/i18n.ts detects language from the browser and
 * loads translations over HTTP, neither of which exists in Node). The page
 * component itself is untouched: it renders in a fixed language either way.
 */
export function renderGenogramPage(lang: GenogramLang, resources: TranslationResources): string {
  const i18n = createInstance();
  i18n.use(initReactI18next).init({
    lng: lang,
    fallbackLng: "en",
    resources: {
      en: { translation: resources.en },
      nl: { translation: resources.nl },
    },
    interpolation: { escapeValue: false },
    // Synchronous init: resources are inline, and renderToString cannot wait.
    initAsync: false,
  });

  return renderToString(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[GENOGRAM_PATHS[lang]]}>
        <GenogramPage lang={lang} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}
