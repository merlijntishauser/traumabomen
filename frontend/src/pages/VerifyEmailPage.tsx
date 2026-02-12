import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../lib/api";
import { AuthHero } from "../components/AuthHero";
import "../styles/auth.css";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="auth-page">
      <AuthHero />
      <div className="auth-content">
        <div className="auth-card">
          <h1>{t("app.title")}</h1>

          {status === "loading" && <p>{t("auth.verifying")}</p>}

          {status === "success" && (
            <>
              <h2>{t("auth.verificationSuccess")}</h2>
              <Link className="auth-submit" to="/login">
                {t("auth.login")}
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <h2>{t("auth.verificationFailed")}</h2>
              <p className="auth-footer">
                <Link to="/login">{t("auth.backToLogin")}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
