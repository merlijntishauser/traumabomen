import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "../styles/privacy.css";

const SECTIONS = [
  "collect",
  "cannotAccess",
  "encryption",
  "hosting",
  "cookies",
  "retention",
  "rights",
  "contact",
] as const;

type Tab = "glance" | "detail";

export default function PrivacyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("glance");
  const [techOpen, setTechOpen] = useState(false);

  return (
    <div className="privacy-page">
      <div className="privacy-content">
        <button type="button" className="privacy-back" onClick={() => navigate(-1)}>
          &larr;
        </button>

        <h1 className="privacy-title">{t("privacy.title")}</h1>
        <p className="privacy-updated">{t("privacy.lastUpdated")}</p>

        {/* Encryption diagram */}
        <div className="privacy-diagram">
          <div className="privacy-diagram__step">
            <div className="privacy-diagram__icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <span className="privacy-diagram__label">{t("privacy.diagram.youType")}</span>
          </div>
          <div className="privacy-diagram__arrow" aria-hidden="true" />
          <div className="privacy-diagram__step">
            <div className="privacy-diagram__icon privacy-diagram__icon--accent">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <span className="privacy-diagram__label">{t("privacy.diagram.encrypted")}</span>
          </div>
          <div className="privacy-diagram__arrow" aria-hidden="true" />
          <div className="privacy-diagram__step">
            <div className="privacy-diagram__icon privacy-diagram__icon--muted">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
                <line x1="12" y1="15" x2="12.01" y2="15" />
              </svg>
            </div>
            <span className="privacy-diagram__label">{t("privacy.diagram.serverStores")}</span>
          </div>
        </div>

        <div className="privacy-tech-details">
          <button
            type="button"
            className="privacy-tech-details__toggle"
            onClick={() => setTechOpen((v) => !v)}
            aria-expanded={techOpen}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              className={`privacy-tech-details__chevron${techOpen ? " privacy-tech-details__chevron--open" : ""}`}
            >
              <path d="M4 3l4 3-4 3z" />
            </svg>
            {t("privacy.diagram.technicalDetails")}
          </button>
          {techOpen && (
            <p className="privacy-tech-details__body">{t("privacy.diagram.technicalBody")}</p>
          )}
        </div>

        <div className="privacy-tabs">
          <button
            type="button"
            className={`privacy-tab${tab === "glance" ? " privacy-tab--active" : ""}`}
            onClick={() => setTab("glance")}
          >
            {t("privacy.tab.glance")}
          </button>
          <button
            type="button"
            className={`privacy-tab${tab === "detail" ? " privacy-tab--active" : ""}`}
            onClick={() => setTab("detail")}
          >
            {t("privacy.tab.detail")}
          </button>
        </div>

        {SECTIONS.map((section) => (
          <section key={section} className="privacy-section">
            <h2>{t(`privacy.${section}.heading`)}</h2>
            <p>{t(`privacy.${section}.${tab === "glance" ? "glance" : "body"}`)}</p>
            {section === "contact" && <p className="privacy-email">privacy@traumatrees.com</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
