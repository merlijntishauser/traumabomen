import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { uuidToCompact } from "../lib/compactId";
import { getPatternColor } from "../lib/patternColors";
import { type EntityMaps, resolveLinkedEntity } from "../lib/patternEntities";
import { getPatternPrompt } from "../lib/reflectionPrompts";
import type { JournalLinkedRef, LinkedEntity } from "../types/domain";
import "./PatternView.css";

interface PatternViewProps {
  treeId: string;
  patterns: Map<string, DecryptedPattern>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  persons: Map<string, DecryptedPerson>;
  showReflectionPrompts?: boolean;
  onOpenJournal?: (prompt: string, linkedRef?: JournalLinkedRef) => void;
}

interface EntityDisplay {
  id: string;
  type: "trauma" | "life" | "turning-point" | "classification";
  label: string;
  personName: string;
}

const ENTITY_TYPE_CSS: Record<LinkedEntity["entity_type"], EntityDisplay["type"]> = {
  trauma_event: "trauma",
  life_event: "life",
  turning_point: "turning-point",
  classification: "classification",
};

function getEntityDisplays(
  pattern: DecryptedPattern,
  maps: EntityMaps,
  t: (key: string) => string,
): EntityDisplay[] {
  return pattern.linked_entities.map((le) => {
    const resolved = resolveLinkedEntity(le, maps, t);
    return {
      id: le.entity_id,
      type: ENTITY_TYPE_CSS[le.entity_type],
      label: resolved.label,
      personName: resolved.personName,
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
  turningPoints,
  classifications,
  persons,
  showReflectionPrompts,
  onOpenJournal,
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
            entityMaps={{ events, lifeEvents, turningPoints, classifications, persons }}
            treeId={treeId}
            onClose={() => setExpandedId(null)}
            showReflectionPrompts={showReflectionPrompts}
            onOpenJournal={onOpenJournal}
          />
        )}

        {patternList.map((pattern) => {
          if (pattern.id === expandedId) return null;
          const entityMaps: EntityMaps = {
            events,
            lifeEvents,
            turningPoints,
            classifications,
            persons,
          };
          const displays = getEntityDisplays(pattern, entityMaps, t);
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
  entityMaps,
  treeId,
  onClose,
  showReflectionPrompts,
  onOpenJournal,
}: {
  pattern: DecryptedPattern;
  entityMaps: EntityMaps;
  treeId: string;
  onClose: () => void;
  showReflectionPrompts?: boolean;
  onOpenJournal?: (prompt: string, linkedRef?: JournalLinkedRef) => void;
}) {
  const { t } = useTranslation();

  // Stable prompt per pattern (re-rolls when selecting a different pattern)
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable per pattern
  const patternPrompt = useMemo(() => getPatternPrompt(t), [pattern.id]);
  const displays = getEntityDisplays(pattern, entityMaps, t);

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

      {showReflectionPrompts && onOpenJournal && (
        <button
          type="button"
          className="detail-panel__prompt"
          onClick={() =>
            onOpenJournal(patternPrompt, { entity_type: "pattern", entity_id: pattern.id })
          }
        >
          {patternPrompt}
        </button>
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
