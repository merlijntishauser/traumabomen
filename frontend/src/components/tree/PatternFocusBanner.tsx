import { Info, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { type EntityMaps, resolveLinkedEntity } from "../../lib/patternEntities";
import "./PatternFocusBanner.css";

interface PatternFocusBannerProps {
  pattern: DecryptedPattern;
  color: string;
  entityMaps: EntityMaps;
  onExit: () => void;
}

/**
 * The on-canvas header for the focused pattern: its name in the pattern colour,
 * an info button opening a detail modal, and an exit control. Shown only while a
 * pattern is spotlit.
 */
export function PatternFocusBanner({
  pattern,
  color,
  entityMaps,
  onExit,
}: PatternFocusBannerProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const entities = pattern.linked_entities.map((le) => ({
    key: `${le.entity_type}:${le.entity_id}`,
    ...resolveLinkedEntity(le, entityMaps, t),
  }));

  return (
    <>
      <div className="pattern-focus-banner">
        <span className="pattern-focus-banner__dot" style={{ backgroundColor: color }} />
        <span className="pattern-focus-banner__name" style={{ color }}>
          {pattern.name}
        </span>
        <button
          type="button"
          className="pattern-focus-banner__btn"
          onClick={() => dialogRef.current?.showModal()}
          aria-label={t("pattern.focus.info")}
        >
          <Info size={15} />
        </button>
        <button
          type="button"
          className="pattern-focus-banner__btn"
          onClick={onExit}
          aria-label={t("pattern.focus.exit")}
        >
          <X size={15} />
        </button>
      </div>

      <dialog ref={dialogRef} className="pattern-focus-modal" aria-label={pattern.name}>
        <div className="pattern-focus-modal__card">
          <div className="pattern-focus-modal__header">
            <span className="pattern-focus-banner__dot" style={{ backgroundColor: color }} />
            <h2 className="pattern-focus-modal__title" style={{ color }}>
              {pattern.name}
            </h2>
            <button
              type="button"
              className="pattern-focus-modal__close"
              onClick={() => dialogRef.current?.close()}
            >
              {t("common.close")}
            </button>
          </div>

          {pattern.description && (
            <p className="pattern-focus-modal__desc">{pattern.description}</p>
          )}

          <div className="pattern-focus-modal__meta">
            {t("pattern.focus.people", { count: pattern.person_ids.length })}
          </div>

          {entities.length > 0 && (
            <ul className="pattern-focus-modal__entities">
              {entities.map((e) => (
                <li key={e.key} className="pattern-focus-modal__entity">
                  <span className="pattern-focus-modal__entity-label">{e.label}</span>
                  {e.personName && (
                    <span className="pattern-focus-modal__entity-person">{e.personName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
