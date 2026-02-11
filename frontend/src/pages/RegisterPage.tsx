import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("app.title")}</h1>
      <h2>{t("auth.register")}</h2>
      <p>{t("auth.passphraseWarning")}</p>
      <p>
        {t("auth.hasAccount")} <Link to="/login">{t("auth.login")}</Link>
      </p>
    </div>
  );
}
