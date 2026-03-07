import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";
import { DIRECTIONAL_TYPES, T_COMMON_CANCEL } from "./RelationshipPopover";

export function RelationshipPrompt({
  person,
  allPersons,
  onCreateRelationship,
  onDismiss,
}: {
  person: DecryptedPerson;
  allPersons: Map<string, DecryptedPerson>;
  onCreateRelationship: (sourceId: string, targetId: string, type: RelationshipType) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"ask" | "pickPerson" | "pickType">("ask");
  const [targetPersonId, setTargetPersonId] = useState<string | null>(null);
  const [swapped, setSwapped] = useState(false);

  const targetPerson = targetPersonId ? allPersons.get(targetPersonId) : null;

  // Smart default: older person is source for parent types
  const personYear = person.birth_year;
  const targetYear = targetPerson?.birth_year;
  const defaultSourceIsNew =
    personYear != null && targetYear != null ? personYear < targetYear : true;
  const sourceIsNew = swapped ? !defaultSourceIsNew : defaultSourceIsNew;

  const sourceId = sourceIsNew ? person.id : (targetPersonId ?? "");
  const targetId = sourceIsNew ? (targetPersonId ?? "") : person.id;
  const sourceName = sourceIsNew ? person.name : (targetPerson?.name ?? "");
  const targetName = sourceIsNew ? (targetPerson?.name ?? "") : person.name;

  const otherPersons = Array.from(allPersons.entries()).filter(([id]) => id !== person.id);

  function formatPersonLabel(p: DecryptedPerson) {
    return p.birth_year ? `${p.name} (${p.birth_year})` : p.name;
  }

  if (step === "ask") {
    return (
      <div className="relationship-prompt">
        <div className="relationship-prompt__card">
          <p className="relationship-prompt__text">
            {t("relationship.promptConnect", { name: person.name })}
          </p>
          <div className="relationship-prompt__actions">
            <button
              type="button"
              className="relationship-prompt__btn relationship-prompt__btn--primary"
              onClick={() => setStep("pickPerson")}
            >
              {t("common.yes")}
            </button>
            <button type="button" className="relationship-prompt__btn" onClick={onDismiss}>
              {t("common.no")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "pickPerson") {
    return (
      <div className="relationship-prompt">
        <div className="relationship-prompt__card relationship-prompt__card--expanded">
          <div className="relationship-prompt__header">
            <p className="relationship-prompt__text">
              {t("relationship.promptConnectTo", { name: person.name })}
            </p>
            <button type="button" className="relationship-prompt__btn" onClick={onDismiss}>
              {t(T_COMMON_CANCEL)}
            </button>
          </div>
          <div className="relationship-prompt__list">
            {otherPersons.map(([id, p]) => (
              <button
                type="button"
                key={id}
                className="relationship-prompt__item"
                onClick={() => {
                  setTargetPersonId(id);
                  setSwapped(false);
                  setStep("pickType");
                }}
              >
                {formatPersonLabel(p)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // pickType step
  return (
    <div className="relationship-prompt">
      <div className="relationship-prompt__card relationship-prompt__card--expanded">
        <div className="relationship-prompt__header">
          <div className="relationship-prompt__direction">
            <span>
              {sourceName} &rarr; {targetName}
            </span>
            <button
              type="button"
              className="relationship-prompt__swap"
              onClick={() => setSwapped((s) => !s)}
            >
              {t("relationship.swap")}
            </button>
          </div>
          <button type="button" className="relationship-prompt__btn" onClick={onDismiss}>
            {t(T_COMMON_CANCEL)}
          </button>
        </div>
        <div className="relationship-prompt__list">
          {Object.values(RelationshipType).map((type) => (
            <button
              type="button"
              key={type}
              className="relationship-prompt__item"
              onClick={() => onCreateRelationship(sourceId, targetId, type)}
            >
              {DIRECTIONAL_TYPES.has(type)
                ? t("relationship.directionLabel", {
                    source: sourceName,
                    type: t(`relationship.type.${type}`).toLowerCase(),
                    target: targetName,
                  })
                : t(`relationship.type.${type}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
