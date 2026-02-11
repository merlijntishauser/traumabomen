import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("app.title")}</h1>
      <h2>{t("auth.login")}</h2>
      <p>
        {t("auth.noAccount")} <Link to="/register">{t("auth.register")}</Link>
      </p>
    </div>
  );
}
