import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BackHome } from "../components/BackHome";
import "../styles/support.css";

const SUPPORT_EMAIL = "support@traumatrees.org";

/** Questions in the order someone stuck is likely to have them. */
const QUESTIONS = ["login", "passphrase", "waitlist", "delete", "export", "mobile"] as const;

export default function SupportPage() {
  const { t } = useTranslation();

  return (
    <div className="support-page">
      <div className="support-content">
        <BackHome />

        <h1 className="support-title">{t("support.title")}</h1>
        <p className="support-lede">{t("support.lede")}</p>

        <section className="support-section">
          <h2>{t("support.contact.heading")}</h2>
          <p>{t("support.contact.body")}</p>
          <p className="support-contact">
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p>{t("support.contact.privacy")}</p>
        </section>

        <section className="support-section">
          <h2>{t("support.faq.heading")}</h2>
          {QUESTIONS.map((id) => (
            <div key={id} className="support-qa">
              <p className="support-qa__q">{t(`support.faq.${id}.q`)}</p>
              <p className="support-qa__a">{t(`support.faq.${id}.a`)}</p>
            </div>
          ))}
        </section>

        <section className="support-section">
          <h2>{t("support.passphrase.heading")}</h2>
          <div className="support-warning">
            <p>{t("support.passphrase.warning")}</p>
          </div>
          <p>{t("support.passphrase.body")}</p>
        </section>

        <section className="support-section">
          <h2>{t("support.crisis.heading")}</h2>
          <p>{t("support.crisis.body")}</p>
          <p>
            <a href="https://www.crisistextline.org" target="_blank" rel="noreferrer">
              {t("support.crisis.link")}
            </a>
          </p>
        </section>

        <section className="support-section">
          <h2>{t("support.security.heading")}</h2>
          <p>{t("support.security.body")}</p>
          <p className="support-contact">
            <a href="mailto:security@traumatrees.org">security@traumatrees.org</a>
          </p>
        </section>

        <section className="support-section">
          <h2>{t("support.more.heading")}</h2>
          <p>
            <Link to="/privacy">{t("nav.privacy")}</Link> ·{" "}
            <Link to="/security">{t("support.more.security")}</Link> ·{" "}
            <Link to="/learn">{t("nav.learn")}</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
