import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { type DecryptedPerson, filterByPerson } from "../../hooks/useTreeData";
import type { DemoTreeState } from "../../lib/buildDemoState";
import "./DemoPersonCard.css";

interface DemoPersonCardProps {
  person: DecryptedPerson;
  state: DemoTreeState;
  onClose: () => void;
}

/** Year range in the same grammar the canvas node uses (spaced hyphen). */
function formatYears(person: DecryptedPerson): string {
  if (person.birth_year != null && person.death_year) {
    return `${person.birth_year} - ${person.death_year}`;
  }
  if (person.birth_year != null) return `${person.birth_year} -`;
  if (person.death_year) return `- ${person.death_year}`;
  return "";
}

/**
 * A lightweight, read-only view of a person in the public demo. It shows the
 * person's details and their linked events and classifications as static text:
 * no inputs, no save, no delete. Deliberately not the live PersonDetailPanel.
 */
export function DemoPersonCard({ person, state, onClose }: DemoPersonCardProps) {
  const { t } = useTranslation();
  const events = filterByPerson(state.events, person.id);
  const lifeEvents = filterByPerson(state.lifeEvents, person.id);
  const classifications = filterByPerson(state.classifications, person.id);
  const years = formatYears(person);

  return (
    <aside className="demo-card" aria-label={person.name}>
      <div className="demo-card__header">
        <div className="demo-card__heading">
          <div className="demo-card__name">{person.name}</div>
          {years && <div className="demo-card__years">{years}</div>}
        </div>
        <button
          type="button"
          className="demo-card__close"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="demo-card__body">
        {person.notes && <p className="demo-card__notes">{person.notes}</p>}

        {events.length > 0 && (
          <section className="demo-card__section">
            <h3 className="demo-card__section-title">{t("trauma.events")}</h3>
            {events.map((e) => (
              <article key={e.id} className="demo-card__item">
                <div className="demo-card__item-title">{e.title}</div>
                {e.approximate_date && (
                  <div className="demo-card__item-meta">{e.approximate_date}</div>
                )}
                {e.description && <p className="demo-card__item-body">{e.description}</p>}
              </article>
            ))}
          </section>
        )}

        {lifeEvents.length > 0 && (
          <section className="demo-card__section">
            <h3 className="demo-card__section-title">{t("lifeEvent.events")}</h3>
            {lifeEvents.map((le) => (
              <article key={le.id} className="demo-card__item">
                <div className="demo-card__item-title">{le.title}</div>
                {le.approximate_date && (
                  <div className="demo-card__item-meta">{le.approximate_date}</div>
                )}
                {le.description && <p className="demo-card__item-body">{le.description}</p>}
              </article>
            ))}
          </section>
        )}

        {classifications.length > 0 && (
          <section className="demo-card__section">
            <h3 className="demo-card__section-title">{t("classification.classifications")}</h3>
            {classifications.map((c) => (
              <article key={c.id} className="demo-card__item">
                <div className="demo-card__item-title">{c.dsm_subcategory || c.dsm_category}</div>
                <div className="demo-card__item-meta">
                  {t(`classification.status.${c.status}`)}
                  {c.diagnosis_year ? `, ${c.diagnosis_year}` : ""}
                </div>
                {c.notes && <p className="demo-card__item-body">{c.notes}</p>}
              </article>
            ))}
          </section>
        )}
      </div>

      <div className="demo-card__cta">
        <p className="demo-card__cta-text">{t("demo.live.cardCta")}</p>
        <Link to="/register" className="btn btn--primary">
          {t("demo.live.cta")}
        </Link>
      </div>
    </aside>
  );
}
