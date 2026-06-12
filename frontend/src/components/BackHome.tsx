import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import "./BackHome.css";

/**
 * The single back-to-home control on public pages: an arrow plus the site
 * name, always linking to the landing page. `hero` renders the translucent
 * over-photo variant used on the auth hero.
 */
export function BackHome({ hero = false }: { hero?: boolean }) {
  const { t } = useTranslation();
  return (
    <Link to="/" className={hero ? "back-home back-home--hero" : "back-home"}>
      <ArrowLeft size={16} aria-hidden="true" />
      {t("app.title")}
    </Link>
  );
}
