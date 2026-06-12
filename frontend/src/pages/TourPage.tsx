import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BackHome } from "../components/BackHome";
import { Glimpse } from "../components/Glimpse";
import "../styles/tour.css";

const STOPS = [
  { key: "canvas", shot: "tree", altKey: "landing.shotTreeAlt" },
  { key: "timeline", shot: "timeline", altKey: "landing.shotTimelineAlt" },
  { key: "patterns", shot: "patterns", altKey: "tour.shotPatternsAlt" },
] as const;

export default function TourPage() {
  const { t } = useTranslation();

  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;

    document.title = `${t("tour.title")} | ${t("app.title")}`;
    meta?.setAttribute("content", t("tour.lede"));

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) {
        meta?.setAttribute("content", previousDescription);
      }
    };
  }, [t]);

  return (
    <div className="tour-page">
      <div className="tour-wrap">
        <BackHome />

        <article>
          <header className="tour-header">
            <h1>{t("tour.title")}</h1>
            <p className="tour-lede">{t("tour.lede")}</p>
            <p className="tour-note">{t("tour.note")}</p>
          </header>

          {STOPS.map((stop, i) => (
            <section key={stop.key} className="tour-stop">
              <span className="tour-stop__num" aria-hidden="true">
                {i + 1}
              </span>
              <h2>{t(`tour.${stop.key}Title`)}</h2>
              <p className="tour-prose">{t(`tour.${stop.key}Body`)}</p>
              <div className="tour-stop__shot">
                <Glimpse name={stop.shot} alt={t(stop.altKey)} eager={i === 0} />
              </div>
            </section>
          ))}

          <footer className="tour-closing">
            <p className="tour-prose">{t("tour.closing")}</p>
            <Link to="/register" className="tour-closing__link">
              {t("landing.ctaCreate")}
            </Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
