import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function AuthWelcome() {
  const { t } = useTranslation();

  return (
    <div className="auth-welcome">
      <p className="auth-welcome__tagline">{t("landing.tagline")}</p>
      <p className="auth-welcome__about">{t("landing.about")}</p>

      <ul className="auth-welcome__features">
        <li>{t("landing.feature1")}</li>
        <li>{t("landing.feature2")}</li>
        <li>{t("landing.feature3")}</li>
      </ul>

      <h3 className="auth-welcome__privacy-heading">{t("landing.privacyHeading")}</h3>
      <p className="auth-welcome__about">{t("landing.privacy")}</p>
      <Link to="/privacy" className="auth-welcome__policy-link">
        {t("landing.readPrivacyPolicy")}
      </Link>
    </div>
  );
}
