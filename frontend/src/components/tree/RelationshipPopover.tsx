import { useTranslation } from "react-i18next";
import type { Connection } from "@xyflow/react";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";

export const T_COMMON_CANCEL = "common.cancel";

export const DIRECTIONAL_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

export function RelationshipPopover({
  connection,
  persons,
  onSelect,
  onSwap,
  onClose,
}: {
  connection: Connection;
  persons: Map<string, DecryptedPerson>;
  onSelect: (type: RelationshipType) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sourceName = persons.get(connection.source!)?.name ?? "?";
  const targetName = persons.get(connection.target!)?.name ?? "?";

  return (
    <div className="relationship-popover" onClick={onClose}>
      <div className="relationship-popover__card" onClick={(e) => e.stopPropagation()}>
        <h3>{t("relationship.selectType")}</h3>
        <div className="relationship-popover__direction">
          <span>
            {sourceName} &rarr; {targetName}
          </span>
          <button type="button" className="relationship-popover__swap" onClick={onSwap}>
            {t("relationship.swap")}
          </button>
        </div>
        <div className="relationship-popover__options">
          {Object.values(RelationshipType).map((type) => (
            <button
              type="button"
              key={type}
              className="relationship-popover__option"
              onClick={() => onSelect(type)}
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
        <button type="button" className="relationship-popover__cancel" onClick={onClose}>
          {t(T_COMMON_CANCEL)}
        </button>
      </div>
    </div>
  );
}
