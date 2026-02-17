import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
} from "../hooks/useTreeData";
import { uuidToCompact } from "../lib/compactId";
import { getPatternColor } from "../lib/patternColors";
import "./PatternView.css";

interface PatternViewProps {
  treeId: string;
  patterns: Map<string, DecryptedPattern>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  persons: Map<string, DecryptedPerson>;
}

interface EntityDisplay {
  id: string;
  type: "trauma" | "life" | "classification";
  label: string;
  personName: string;
}

function getEntityDisplays(
  pattern: DecryptedPattern,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
  persons: Map<string, DecryptedPerson>,
  t: (key: string, opts?: Record<string, string>) => string,
): EntityDisplay[] {
  return pattern.linked_entities.map((le) => {
    if (le.entity_type === "trauma_event") {
      const ev = events.get(le.entity_id);
      const personName = ev?.person_ids[0] ? (persons.get(ev.person_ids[0])?.name ?? "") : "";
      return { id: le.entity_id, type: "trauma" as const, label: ev?.title ?? "?", personName };
    }
    if (le.entity_type === "life_event") {
      const ev = lifeEvents.get(le.entity_id);
      const personName = ev?.person_ids[0] ? (persons.get(ev.person_ids[0])?.name ?? "") : "";
      return { id: le.entity_id, type: "life" as const, label: ev?.title ?? "?", personName };
    }
    const cls = classifications.get(le.entity_id);
    const personName = cls?.person_ids[0] ? (persons.get(cls.person_ids[0])?.name ?? "") : "";
    return {
      id: le.entity_id,
      type: "classification" as const,
      label: cls
        ? cls.dsm_subcategory
          ? t(`dsm.sub.${cls.dsm_subcategory}`)
          : t(`dsm.${cls.dsm_category}`)
        : "?",
      personName,
    };
  });
}

function countGenerations(
  pattern: DecryptedPattern,
  persons: Map<string, DecryptedPerson>,
): number {
  const birthYears = new Set<number>();
  for (const pid of pattern.person_ids) {
    const p = persons.get(pid);
    if (p?.birth_year) birthYears.add(p.birth_year);
  }
  if (birthYears.size <= 1) return 1;
  const sorted = Array.from(birthYears).sort((a, b) => a - b);
  const range = sorted[sorted.length - 1] - sorted[0];
  return Math.max(1, Math.ceil(range / 25));
}

const MAX_CARD_ENTITIES = 4;

export function PatternView({
  treeId,
  patterns,
  events,
  lifeEvents,
  classifications,
  persons,
}: PatternViewProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const patternList = useMemo(() => Array.from(patterns.values()), [patterns]);
  const compactId = uuidToCompact(treeId);

  if (patternList.length === 0) {
    return (
      <div className="pattern-view">
        <div className="pattern-view__empty">
          <p>{t("pattern.empty")}</p>
          <Link to={`/trees/${compactId}`}>{t("pattern.createFirst")}</Link>
        </div>
      </div>
    );
  }

  const expandedPattern = expandedId ? patterns.get(expandedId) : null;

  return (
    <div className="pattern-view">
      <div className="pattern-view__grid">
        {expandedPattern && (
          <PatternDetail
            pattern={expandedPattern}
            events={events}
            lifeEvents={lifeEvents}
            classifications={classifications}
            persons={persons}
            treeId={treeId}
            onClose={() => setExpandedId(null)}
          />
        )}

        {patternList.map((pattern) => {
          if (pattern.id === expandedId) return null;
          const displays = getEntityDisplays(
            pattern,
            events,
            lifeEvents,
            classifications,
            persons,
            t,
          );
          const generations = countGenerations(pattern, persons);

          return (
            <div
              key={pattern.id}
              className="pattern-view__card"
              onClick={() => setExpandedId(pattern.id)}
              data-testid="pattern-card"
            >
              <div className="pattern-view__card-header">
                <div
                  className="pattern-view__card-dot"
                  style={{ backgroundColor: getPatternColor(pattern.color) }}
                />
                <span className="pattern-view__card-name">{pattern.name}</span>
                <span className="pattern-view__card-count">{pattern.linked_entities.length}</span>
              </div>

              {pattern.description && (
                <div className="pattern-view__card-desc">{pattern.description}</div>
              )}

              {displays.length > 0 && (
                <div className="pattern-view__card-entities">
                  {displays.slice(0, MAX_CARD_ENTITIES).map((d) => (
                    <div key={d.id} className="pattern-view__card-entity">
                      <div
                        className={`pattern-view__card-entity-dot pattern-view__card-entity-dot--${d.type}`}
                      />
                      <span>
                        {d.label}
                        {d.personName ? ` (${d.personName})` : ""}
                      </span>
                    </div>
                  ))}
                  {displays.length > MAX_CARD_ENTITIES && (
                    <span className="pattern-view__card-more">
                      +{displays.length - MAX_CARD_ENTITIES} more
                    </span>
                  )}
                </div>
              )}

              <div className="pattern-view__card-footer">
                {t("pattern.spansGenerations", { count: generations })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PatternDetail({
  pattern,
  events,
  lifeEvents,
  classifications,
  persons,
  treeId,
  onClose,
}: {
  pattern: DecryptedPattern;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  persons: Map<string, DecryptedPerson>;
  treeId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const displays = getEntityDisplays(pattern, events, lifeEvents, classifications, persons, t);

  return (
    <div className="pattern-view__detail">
      <div className="pattern-view__detail-header">
        <div
          className="pattern-view__card-dot"
          style={{ backgroundColor: getPatternColor(pattern.color) }}
        />
        <span className="pattern-view__detail-name">{pattern.name}</span>
        <button type="button" className="pattern-view__detail-close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      {pattern.description && (
        <div className="pattern-view__detail-desc">{pattern.description}</div>
      )}

      <div className="pattern-view__detail-entities">
        {displays.map((d) => (
          <div key={d.id} className="pattern-view__detail-entity">
            <div
              className={`pattern-view__card-entity-dot pattern-view__card-entity-dot--${d.type}`}
            />
            <span>
              {d.label}
              {d.personName ? ` (${d.personName})` : ""}
            </span>
          </div>
        ))}
      </div>

      <Link
        to={`/trees/${uuidToCompact(treeId)}`}
        state={{ openPatternId: pattern.id }}
        className="pattern-view__detail-link"
      >
        {t("pattern.editOnCanvas")}
      </Link>
    </div>
  );
}
