import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BackHome } from "../components/BackHome";
import { Glimpse } from "../components/Glimpse";
import { genogramJsonLd } from "../prerender/html";
import "../styles/learn.css";
import "../styles/genogram.css";

export type GenogramLang = "en" | "nl";

// These pages are language-fixed rather than host-detected: /genogram is the
// English page and /genogram-maken the Dutch one, whichever domain serves it.
const OTHER_PATH: Record<GenogramLang, string> = {
  en: "/genogram-maken",
  nl: "/genogram",
};

/**
 * Public landing page explaining what a genogram is and how Traumatrees
 * differs from other genogram software. Rendered at /genogram (English) and
 * /genogram-maken (Dutch); both routes are prerendered to static HTML at
 * build time so crawlers see the full content without running JavaScript.
 */
export default function GenogramPage({ lang }: { lang: GenogramLang }) {
  // Fixed-language translation regardless of the detected UI language;
  // react-i18next loads the bundle on demand (a Dutch-host visitor opening
  // the English page, or the reverse) and suspends until it is ready.
  const { t } = useTranslation("translation", { lng: lang });

  // Per-page head values for client-side navigation; direct loads are served
  // the prerendered file, which carries these baked into the head already.
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;

    document.title = `${t("genogram.title")} | ${t("app.title")}`;
    meta?.setAttribute("content", t("genogram.metaDescription"));

    // On a direct load the prerendered head already carries this block;
    // replace it rather than duplicating the structured data.
    document.head.querySelector('script[type="application/ld+json"][data-prerender]')?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = genogramJsonLd(lang, t);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) {
        meta?.setAttribute("content", previousDescription);
      }
      script.remove();
    };
  }, [t, lang]);

  return (
    <div className="learn-page">
      <div className="learn-wrap">
        <BackHome />

        <article>
          <header className="learn-header">
            <h1>{t("genogram.title")}</h1>
            <p className="learn-lede">{t("genogram.lede")}</p>
          </header>

          <section className="learn-section">
            <h2>{t("genogram.whatTitle")}</h2>
            <p className="learn-glance">{t("genogram.whatGlance")}</p>
            <p className="learn-prose">{t("genogram.whatBody1")}</p>
            <p className="learn-prose">{t("genogram.whatBody2")}</p>
            <p className="learn-prose">{t("genogram.whatBody3")}</p>
          </section>

          <figure className="genogram-figure">
            {/* TODO(assets): replace with a capture of an actual genogram-style
                tree once available; the workspace glimpse is the interim shot. */}
            <Glimpse name="tree" alt={t("genogram.figureTreeAlt")} />
            <figcaption>{t("genogram.figureTreeCaption")}</figcaption>
          </figure>

          <section className="learn-section">
            <h2>{t("genogram.stepsTitle")}</h2>
            <p className="learn-glance">{t("genogram.stepsGlance")}</p>
            <ol className="genogram-steps">
              <li className="learn-prose">{t("genogram.step1")}</li>
              <li className="learn-prose">{t("genogram.step2")}</li>
              <li className="learn-prose">{t("genogram.step3")}</li>
            </ol>
          </section>

          <section className="learn-section">
            <h2>{t("genogram.howTitle")}</h2>
            <p className="learn-glance">{t("genogram.howGlance")}</p>

            <h3 className="genogram-sub">{t("genogram.howPrivacyTitle")}</h3>
            <p className="learn-prose">{t("genogram.howPrivacyBody")}</p>

            <h3 className="genogram-sub">{t("genogram.howFamiliesTitle")}</h3>
            <p className="learn-prose">{t("genogram.howFamiliesBody")}</p>

            <h3 className="genogram-sub">{t("genogram.howFreeTitle")}</h3>
            <p className="learn-prose">{t("genogram.howFreeBody")}</p>

            <h3 className="genogram-sub">{t("genogram.howLockTitle")}</h3>
            <p className="learn-prose">{t("genogram.howLockBody")}</p>
          </section>

          <figure className="genogram-figure">
            {/* TODO(assets): replace with a pattern-view capture showing a
                multi-generation pattern once available. */}
            <Glimpse name="patterns" alt={t("genogram.figurePatternsAlt")} />
            <figcaption>{t("genogram.figurePatternsCaption")}</figcaption>
          </figure>

          <footer className="learn-closing">
            <p className="learn-prose">{t("genogram.closing")}</p>
            <div className="genogram-ctas">
              <Link to="/register" className="learn-closing__link">
                {t("landing.ctaCreate")}
              </Link>
              <Link to="/demo" className="genogram-cta-secondary">
                {t("genogram.ctaDemo")}
              </Link>
            </div>
            <p className="genogram-other-language">
              <Link to={OTHER_PATH[lang]}>{t("genogram.otherLanguage")}</Link>
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
