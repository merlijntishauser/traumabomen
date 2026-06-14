import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { countGenerations, type EntityMaps, resolveLinkedEntity } from "../../lib/patternEntities";
import "./PatternFocusPanel.css";

interface PatternFocusPanelProps {
  pattern: DecryptedPattern;
  color: string;
  entityMaps: EntityMaps;
  onExit: () => void;
}

/**
 * The in-scene detail card for the focused pattern, sitting in the lower-left of
 * the dimmed canvas (not a popped-over modal). Always shown while a pattern is
 * spotlit: its name in the pattern colour, the description, how many people and
 * generations it spans, and the linked entities with the person each touches.
 */
export function PatternFocusPanel({ pattern, color, entityMaps, onExit }: PatternFocusPanelProps) {
  const { t } = useTranslation();
  const entities = pattern.linked_entities.map((le) => ({
    key: `${le.entity_type}:${le.entity_id}`,
    ...resolveLinkedEntity(le, entityMaps, t),
  }));
  const generations = countGenerations(pattern.person_ids, entityMaps.persons);

  return (
    <aside className="pattern-focus-panel" style={{ borderTopColor: color }}>
      <div className="pattern-focus-panel__header">
        <span className="pattern-focus-panel__dot" style={{ backgroundColor: color }} />
        <h2 className="pattern-focus-panel__name" style={{ color }}>
          {pattern.name}
        </h2>
        <button
          type="button"
          className="pattern-focus-panel__exit"
          onClick={onExit}
          aria-label={t("pattern.focus.exit")}
        >
          <X size={15} />
        </button>
      </div>

      {pattern.description && <p className="pattern-focus-panel__desc">{pattern.description}</p>}

      <div className="pattern-focus-panel__meta">
        <span>{t("pattern.focus.people", { count: pattern.person_ids.length })}</span>
        <span>{t("pattern.spansGenerations", { count: generations })}</span>
      </div>

      {entities.length > 0 && (
        <ul className="pattern-focus-panel__entities">
          {entities.map((e) => (
            <li key={e.key} className="pattern-focus-panel__entity">
              <span className="pattern-focus-panel__entity-label">{e.label}</span>
              {e.personName && (
                <span className="pattern-focus-panel__entity-person">{e.personName}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
