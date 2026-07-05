/**
 * Postbuild prerender for the genogram landing pages.
 *
 * Runs after `vite build` (client) and `vite build --ssr` (this bundle's
 * source is src/prerender/entry.tsx). Renders /genogram and /genogram-maken
 * to static HTML with page-specific head values baked in, so crawlers and
 * social-card scrapers see title, description, canonical, hreflang, and the
 * full page content without executing JavaScript. nginx serves the files
 * via exact-match locations; every other route keeps the SPA shell with its
 * per-host placeholder substitution.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(frontendRoot, "dist");
const distSsr = join(frontendRoot, "dist-ssr");

const {
  renderGenogramPage,
  fillPlaceholders,
  genogramJsonLd,
  genogramPageMeta,
  injectJsonLd,
  injectRoot,
  GENOGRAM_PATHS,
} = await import(pathToFileURL(join(distSsr, "entry.js")).href);

const template = readFileSync(join(dist, "index.html"), "utf8");
const resources = {
  en: JSON.parse(readFileSync(join(dist, "locales/en/translation.json"), "utf8")),
  nl: JSON.parse(readFileSync(join(dist, "locales/nl/translation.json"), "utf8")),
};

const OUTPUT_FILES = { en: "genogram.html", nl: "genogram-maken.html" };

for (const lang of ["en", "nl"]) {
  const meta = genogramPageMeta(lang, resources[lang]);
  const jsonLd = genogramJsonLd(lang, (key) => resources[lang][key]);
  const body = renderGenogramPage(lang, resources);
  const page = injectRoot(injectJsonLd(fillPlaceholders(template, meta), jsonLd), body);
  writeFileSync(join(dist, OUTPUT_FILES[lang]), page);
  console.log(`prerendered ${GENOGRAM_PATHS[lang]} -> dist/${OUTPUT_FILES[lang]}`);
}

// The SSR bundle is only needed by this script; keep it out of the image.
rmSync(distSsr, { recursive: true, force: true });
