import type { Connection } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson, DecryptedSiblingGroup } from "../../hooks/useTreeData";
import { siblingGroupIdFromNodeId } from "../../lib/siblingGroupConnect";
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
  siblingGroups,
  onSelect,
  onSwap,
  onClose,
}: {
  connection: Connection;
  persons: Map<string, DecryptedPerson>;
  siblingGroups: Map<string, DecryptedSiblingGroup>;
  onSelect: (type: RelationshipType) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // A sibling-group pill endpoint stands in for the in-tree siblings it links.
  const endpointName = (id: string | null | undefined): string => {
    const groupId = siblingGroupIdFromNodeId(id);
    if (groupId) {
      return t("siblingGroup.label", { count: siblingGroups.get(groupId)?.person_ids.length ?? 0 });
    }
    return (id && persons.get(id)?.name) || "?";
  };
  const sourceName = endpointName(connection.source);
  const targetName = endpointName(connection.target);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    function handleBackdropClick(e: MouseEvent) {
      if (e.target === dialog) onClose();
    }
    dialog.addEventListener("click", handleBackdropClick);
    return () => dialog.removeEventListener("click", handleBackdropClick);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="relationship-popover"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="relationship-popover__card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
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
    </dialog>
  );
}
