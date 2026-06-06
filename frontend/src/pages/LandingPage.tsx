import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { AuthHero } from "../components/AuthHero";
import { getAccessToken } from "../lib/api";
import "../styles/landing.css";

const FAQ_KEYS = [1, 2, 3, 4] as const;

const HOW_STEPS = [
  { n: 1, title: "landing.step1Title", body: "landing.step1Body" },
  { n: 2, title: "landing.step2Title", body: "landing.step2Body" },
  { n: 3, title: "landing.step3Title", body: "landing.step3Body" },
] as const;

export default function LandingPage() {
  const { t } = useTranslation();
  const authed = !!getAccessToken();

  // Inject SoftwareApplication + FAQ structured data for search engines. The
  // FAQ content here is the static i18n fallback; an admin-managed FAQ can
  // replace it later (see docs/plans/2026-06-06-faq-admin-design.md).
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
          mainEntity: FAQ_KEYS.map((n) => ({
            "@type": "Question",
            name: t(`landing.faqQ${n}`),
            acceptedAnswer: { "@type": "Answer", text: t(`landing.faqA${n}`) },
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
  }, [authed, t]);

  // Logged-in visitors skip the marketing page.
  if (authed) {
    return <Navigate to="/trees" replace />;
  }

  return (
    <div className="landing">
      <AuthHero />

      <header className="landing__intro">
        <h1 className="landing__title">{t("app.title")}</h1>
        <p className="landing__lede">{t("landing.heroIntro")}</p>
        <div className="landing__cta-row">
          <Link to="/register" className="landing__cta landing__cta--primary">
            {t("landing.ctaCreate")}
          </Link>
          <Link to="/login" className="landing__cta landing__cta--ghost">
            {t("landing.ctaSignIn")}
          </Link>
        </div>
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
          <Link to="/privacy" className="landing__link">
            {t("landing.readPrivacyPolicy")}
          </Link>
        </section>

        <section className="landing__section">
          <h2 className="landing__section-title">{t("landing.whoTitle")}</h2>
          <p className="landing__prose">{t("landing.whoBody")}</p>
        </section>

        <section className="landing__section">
          <h2 className="landing__section-title">{t("landing.faqTitle")}</h2>
          <dl className="landing__faq">
            {FAQ_KEYS.map((n) => (
              <div key={n} className="landing__faq-item">
                <dt className="landing__faq-q">{t(`landing.faqQ${n}`)}</dt>
                <dd className="landing__faq-a">{t(`landing.faqA${n}`)}</dd>
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
