import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import "../styles/learn.css";

const REFERENCES = [
  { key: "ref1", url: "https://dictionary.apa.org/intergenerational-trauma" },
  { key: "ref2", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6127768/" },
  { key: "ref3", url: "https://www.thebowencenter.org/introduction-eight-concepts" },
  { key: "ref4", url: "https://www.nctsn.org/what-is-child-trauma/trauma-types" },
] as const;

export default function LearnPage() {
  const { t } = useTranslation();

  // Per-page title, description, and Article structured data: this page is the
  // site's main indexable educational content.
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;

    document.title = `${t("learn.title")} | ${t("app.title")}`;
    meta?.setAttribute("content", t("learn.lede"));

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: t("learn.title"),
      description: t("learn.lede"),
      author: { "@type": "Organization", name: t("app.title") },
    });
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) {
        meta?.setAttribute("content", previousDescription);
      }
      script.remove();
    };
  }, [t]);

  return (
    <div className="learn-page">
      <div className="learn-wrap">
        <Link to="/" className="learn-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("app.title")}
        </Link>

        <article>
          <header className="learn-header">
            <h1>{t("learn.title")}</h1>
            <p className="learn-lede">{t("learn.lede")}</p>
          </header>

          <section className="learn-section">
            <h2>{t("learn.whatTitle")}</h2>
            <p className="learn-glance">{t("learn.whatGlance")}</p>
            <p className="learn-prose">{t("learn.whatBody1")}</p>
            <p className="learn-prose">{t("learn.whatBody2")}</p>
            <p className="learn-prose">{t("learn.whatBody3")}</p>
          </section>

          <section className="learn-section">
            <h2>{t("learn.mapTitle")}</h2>
            <p className="learn-glance">{t("learn.mapGlance")}</p>
            <p className="learn-prose">{t("learn.mapBody1")}</p>
            <p className="learn-prose">{t("learn.mapBody2")}</p>
            <p className="learn-prose">{t("learn.mapBody3")}</p>
          </section>

          <section className="learn-section">
            <h2>{t("learn.referencesTitle")}</h2>
            <ul className="learn-references">
              {REFERENCES.map((ref) => (
                <li key={ref.key}>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer">
                    {t(`learn.${ref.key}Label`)}
                  </a>
                  <p className="learn-prose">{t(`learn.${ref.key}Desc`)}</p>
                </li>
              ))}
            </ul>
          </section>

          <footer className="learn-closing">
            <p className="learn-prose">{t("learn.closing")}</p>
            <Link to="/register" className="learn-closing__link">
              {t("landing.ctaCreate")}
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
