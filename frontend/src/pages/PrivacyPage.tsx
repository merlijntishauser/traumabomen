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

  return (
    <div className="privacy-page">
      <div className="privacy-content">
        <button type="button" className="privacy-back" onClick={() => navigate(-1)}>
          &larr;
        </button>

        <h1 className="privacy-title">{t("privacy.title")}</h1>
        <p className="privacy-updated">{t("privacy.lastUpdated")}</p>

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
