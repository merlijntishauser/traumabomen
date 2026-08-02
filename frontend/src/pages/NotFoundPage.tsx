import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import "../styles/not-found.css";

/**
 * Shown for any path the router does not know.
 *
 * The app is served as a single page, so nginx answers every URL with 200 and
 * there is no way to return a real 404 status from here. A crawler that finds
 * a stale or mistyped link would otherwise take the 200 and index whatever it
 * was shown, which is Search Console's "soft 404". The noindex tag is what
 * keeps these out of the index; it is added per-render and removed on the way
 * out so it never leaks onto a real page.
 */
export default function NotFoundPage() {
  const { t } = useTranslation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t("notFound.title")} | ${t("app.title")}`;

    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, follow";
    document.head.appendChild(robots);

    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, [t]);

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-title">{t("notFound.title")}</h1>
        <p className="not-found-body">{t("notFound.body")}</p>

        <nav className="not-found-links" aria-label={t("notFound.linksLabel")}>
          <Link to="/">{t("notFound.home")}</Link>
          <Link to="/learn">{t("nav.learn")}</Link>
          <Link to="/support">{t("nav.support")}</Link>
        </nav>
      </div>
    </div>
  );
}
