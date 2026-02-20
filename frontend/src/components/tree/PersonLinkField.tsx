import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson } from "../../hooks/useTreeData";

interface PersonLinkFieldProps {
  allPersons: Map<string, DecryptedPerson>;
  selectedIds: Set<string>;
  onChange: (newIds: Set<string>) => void;
}

export function PersonLinkField({
  allPersons,
  selectedIds,
  onChange,
}: PersonLinkFieldProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const selectedNames = [...selectedIds]
    .map((id) => allPersons.get(id)?.name)
    .filter(Boolean)
    .join(", ");

  const sortedPersons = [...allPersons.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  function handleToggle(personId: string) {
    if (selectedIds.has(personId) && selectedIds.size <= 1) return;
    const next = new Set(selectedIds);
    if (next.has(personId)) {
      next.delete(personId);
    } else {
      next.add(personId);
    }
    onChange(next);
  }

  return (
    <div className="detail-panel__person-link">
      <div className="detail-panel__person-link-summary">
        <span className="detail-panel__person-link-names">{selectedNames}</span>
        <button
          type="button"
          className="detail-panel__person-link-expand"
          onClick={() => setExpanded(true)}
        >
          {t("pattern.linkEntity")}
        </button>
      </div>
      {expanded && (
        <fieldset className="detail-panel__person-checkboxes">
          {sortedPersons.map((p) => (
            <label key={p.id} className="detail-panel__field--checkbox">
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => handleToggle(p.id)}
                aria-label={p.name}
              />
              <span>{p.name}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
