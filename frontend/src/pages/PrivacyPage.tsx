import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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

  return (
    <div className="privacy-page">
      <div className="privacy-content">
        <Link to="/login" className="privacy-back">
          &larr;
        </Link>

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
