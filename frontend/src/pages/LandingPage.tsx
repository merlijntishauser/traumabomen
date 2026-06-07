import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { getAccessToken, getFaq } from "../lib/api";
import "../styles/landing.css";

const FAQ_KEYS = [1, 2, 3, 4] as const;

const HOW_STEPS = [
  { n: 1, title: "landing.step1Title", body: "landing.step1Body" },
  { n: 2, title: "landing.step2Title", body: "landing.step2Body" },
  { n: 3, title: "landing.step3Title", body: "landing.step3Body" },
] as const;

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const authed = !!getAccessToken();
  const lang = i18n.language?.startsWith("nl") ? "nl" : "en";

  // Live admin-managed FAQ, falling back to the static i18n copy when the
  // endpoint is empty or unreachable (see docs/plans/2026-06-06-faq-admin-design.md).
  const { data: faqData } = useQuery({ queryKey: ["faq"], queryFn: getFaq, enabled: !authed });
  const faqItems = useMemo(() => {
    const entries = faqData?.entries ?? [];
    if (entries.length > 0) {
      return entries.map((e) => ({
        key: e.id,
        question: lang === "nl" ? e.question_nl : e.question_en,
        answer: lang === "nl" ? e.answer_nl : e.answer_en,
      }));
    }
    return FAQ_KEYS.map((n) => ({
      key: `static-${n}`,
      question: t(`landing.faqQ${n}`),
      answer: t(`landing.faqA${n}`),
    }));
  }, [faqData, lang, t]);

  // Inject SoftwareApplication + FAQ structured data for search engines.
  useEffect(() => {
    if (authed) return;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          name: t("app.title"),
          applicationCategory: "LifestyleApplication",
          operatingSystem: "Web",
          description: t("landing.about"),
        },
        {
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        },
      ],
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [authed, t, faqItems]);

  // Logged-in visitors skip the marketing page.
  if (authed) {
    return <Navigate to="/trees" replace />;
  }

  return (
    <div className="landing">
      <section className="landing__hero">
        <picture>
          <source srcSet="/images/hero-dark.webp" type="image/webp" />
          <img
            className="landing__hero-img landing__hero-img--dark"
            src="/images/hero-dark.jpg"
            alt=""
            decoding="async"
          />
        </picture>
        <picture>
          <source srcSet="/images/hero-light.webp" type="image/webp" />
          <img
            className="landing__hero-img landing__hero-img--light"
            src="/images/hero-light.jpg"
            alt=""
            decoding="async"
          />
        </picture>
        <div className="landing__hero-shell">
          <header className="landing__hero-content">
            <p className="landing__hero-message">{t("landing.heroTagline")}</p>
            <div className="landing__cta-row">
              <Link to="/register" className="landing__cta landing__cta--primary">
                {t("landing.ctaCreate")}
              </Link>
              <Link to="/login" className="landing__cta landing__cta--ghost">
                {t("landing.ctaLogin")}
              </Link>
            </div>
          </header>
        </div>
      </section>

      <header className="landing__intro">
        <h1 className="landing__title">{t("app.title")}</h1>
        <p className="landing__lede">{t("landing.heroIntro")}</p>
      </header>

      <div className="landing__sections">
        <section className="landing__section">
          <h2 className="landing__section-title">{t("landing.whatTitle")}</h2>
          <p className="landing__prose">{t("landing.whatBody")}</p>
        </section>

        <section className="landing__section">
          <h2 className="landing__section-title">{t("landing.howTitle")}</h2>
          <ol className="landing__steps">
            {HOW_STEPS.map((step) => (
              <li key={step.n} className="landing__step">
                <span className="landing__step-num" aria-hidden="true">
                  {step.n}
                </span>
                <h3 className="landing__step-title">{t(step.title)}</h3>
                <p className="landing__prose">{t(step.body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing__section landing__section--privacy">
          <h2 className="landing__section-title">{t("landing.privacyHeading")}</h2>
          <p className="landing__glance">{t("landing.privacyGlance")}</p>
          <p className="landing__prose">{t("landing.privacy")}</p>
          <div className="landing__links">
            <Link to="/security" className="landing__link">
              {t("security.link")}
            </Link>
            <Link to="/privacy" className="landing__link">
              {t("landing.readPrivacyPolicy")}
            </Link>
          </div>
        </section>

        <section className="landing__section">
          <h2 className="landing__section-title">{t("landing.whoTitle")}</h2>
          <p className="landing__prose">{t("landing.whoBody")}</p>
        </section>

        <section className="landing__section">
          <h2 className="landing__section-title">{t("landing.faqTitle")}</h2>
          <dl className="landing__faq">
            {faqItems.map((item) => (
              <div key={item.key} className="landing__faq-item">
                <dt className="landing__faq-q">{item.question}</dt>
                <dd className="landing__faq-a">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="landing__section landing__final">
          <h2 className="landing__section-title">{t("landing.finalCtaTitle")}</h2>
          <p className="landing__prose">{t("landing.finalCtaBody")}</p>
          <Link to="/register" className="landing__cta landing__cta--primary">
            {t("landing.ctaCreate")}
          </Link>
        </section>
      </div>
    </div>
  );
}
