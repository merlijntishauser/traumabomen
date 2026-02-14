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

export default function PrivacyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="privacy-page">
      <div className="privacy-content">
        <button type="button" className="privacy-back" onClick={() => navigate(-1)}>
          &larr;
        </button>

        <h1 className="privacy-title">{t("privacy.title")}</h1>
        <p className="privacy-updated">{t("privacy.lastUpdated")}</p>

        {SECTIONS.map((section) => (
          <section key={section} className="privacy-section">
            <h2>{t(`privacy.${section}.heading`)}</h2>
            <p>{t(`privacy.${section}.body`)}</p>
            {section === "contact" && <p className="privacy-email">privacy@traumatrees.com</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
