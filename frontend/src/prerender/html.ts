import type { GenogramLang } from "../pages/GenogramPage";

/**
 * Pure helpers for build-time prerendering of the genogram landing pages.
 * They fill the same __OG_*__ placeholders that nginx substitutes per host
 * for the SPA shell, except with page-specific values: these two routes are
 * language-fixed, so their canonical and hreflang pair cross two domains
 * with two different paths, which the per-host nginx maps cannot express.
 */

const GENOGRAM_ORIGINS: Record<GenogramLang, string> = {
  en: "https://www.traumatrees.org",
  nl: "https://www.traumabomen.nl",
};

export const GENOGRAM_PATHS: Record<GenogramLang, string> = {
  en: "/genogram",
  nl: "/genogram-maken",
};

const LOCALES: Record<GenogramLang, string> = {
  en: "en_US",
  nl: "nl_NL",
};

export interface PageMeta {
  lang: GenogramLang;
  locale: string;
  origin: string;
  canonical: string;
  title: string;
  description: string;
}

/** Escape a string for use in HTML text and double-quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compose the head values for one genogram page from its translation map. */
export function genogramPageMeta(
  lang: GenogramLang,
  translations: Record<string, string>,
): PageMeta {
  return {
    lang,
    locale: LOCALES[lang],
    origin: GENOGRAM_ORIGINS[lang],
    canonical: `${GENOGRAM_ORIGINS[lang]}${GENOGRAM_PATHS[lang]}`,
    title: `${translations["genogram.title"]} | ${translations["app.title"]}`,
    description: translations["genogram.metaDescription"],
  };
}

/**
 * SoftwareApplication structured data for one genogram page. Shared between
 * the runtime head effect (client-side navigation) and the build-time
 * prerender, which bakes it into the static head. "<" is escaped so no
 * translation string could ever close the surrounding script element early.
 */
export function genogramJsonLd(lang: GenogramLang, t: (key: string) => string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: t("app.title"),
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    description: t("genogram.metaDescription"),
    url: `${GENOGRAM_ORIGINS[lang]}${GENOGRAM_PATHS[lang]}`,
    inLanguage: lang,
  }).replace(/</g, "\\u003c");
}

/**
 * Inject a JSON-LD data block just before the closing head tag. JSON-LD is
 * inert (browsers never execute data blocks, so CSP script-src does not
 * apply); crawlers read it from the raw HTML.
 */
export function injectJsonLd(template: string, jsonLd: string): string {
  const marker = "</head>";
  if (!template.includes(marker)) {
    throw new Error("prerender: could not find </head> in index.html");
  }
  return template.replace(marker, `<script type="application/ld+json">${jsonLd}</script></head>`);
}

/**
 * Fill every __OG_*__ placeholder in the SPA shell with this page's values.
 * The hreflang alternates always name both language editions, whichever
 * language the page itself is in; x-default reuses the EN alternate.
 */
export function fillPlaceholders(template: string, meta: PageMeta): string {
  return template
    .replaceAll("__OG_LANG__", meta.lang)
    .replaceAll("__OG_LOCALE__", meta.locale)
    .replaceAll("__OG_TITLE__", escapeHtml(meta.title))
    .replaceAll("__OG_DESC__", escapeHtml(meta.description))
    .replaceAll("__OG_CANONICAL__", meta.canonical)
    .replaceAll("__OG_ALT_EN__", `${GENOGRAM_ORIGINS.en}${GENOGRAM_PATHS.en}`)
    .replaceAll("__OG_ALT_NL__", `${GENOGRAM_ORIGINS.nl}${GENOGRAM_PATHS.nl}`)
    .replaceAll("__OG_ORIGIN__", meta.origin);
}

/** Inject prerendered markup into the SPA shell's empty root element. */
export function injectRoot(template: string, html: string): string {
  const marker = '<div id="root"></div>';
  if (!template.includes(marker)) {
    throw new Error("prerender: could not find the empty #root element in index.html");
  }
  return template.replace(marker, `<div id="root">${html}</div>`);
}
