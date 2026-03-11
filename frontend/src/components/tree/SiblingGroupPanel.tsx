import { ArrowUpRight, Plus, Trash2, User, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson, DecryptedSiblingGroup } from "../../hooks/useTreeData";
import type { SiblingGroupMember } from "../../types/domain";
import "./SiblingGroupPanel.css";

type KeyedSiblingGroupMember = SiblingGroupMember & { _key: string };

interface SiblingGroupPanelProps {
  group: DecryptedSiblingGroup;
  allPersons: Map<string, DecryptedPerson>;
  onSave: (groupId: string, members: SiblingGroupMember[], personIds: string[]) => void;
  onDelete: (groupId: string) => void;
  onPromote: (groupId: string, memberIndex: number) => void;
  onClose: () => void;
}

export function SiblingGroupPanel({
  group,
  allPersons,
  onSave,
  onDelete,
  onPromote,
  onClose,
}: SiblingGroupPanelProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<KeyedSiblingGroupMember[]>(() =>
    group.members.map((m) => ({ ...m, _key: crypto.randomUUID() })),
  );

  // Exclude the person themselves (always in person_ids) from the sibling count
  const otherPersonCount = Math.max(0, group.person_ids.length - 1);
  const siblingCount = members.length + otherPersonCount;

  function handleNameChange(key: string, name: string) {
    setMembers((prev) => prev.map((m) => (m._key === key ? { ...m, name } : m)));
  }

  function handleFieldChange(key: string, field: string, value: string) {
    setMembers((prev) =>
      prev.map((m) => {
        if (m._key !== key) return m;
        if (field === "birth_year" || field === "death_year") {
          return { ...m, [field]: value ? parseInt(value, 10) : null };
        }
        return { ...m, [field]: value };
      }),
    );
  }

  function handleAddMember() {
    setMembers((prev) => [...prev, { name: "", birth_year: null, _key: crypto.randomUUID() }]);
  }

  function handleRemoveMember(key: string) {
    setMembers((prev) => prev.filter((m) => m._key !== key));
  }

  function handleSave() {
    const cleanedMembers = members.map(({ _key, ...rest }) => rest);
    onSave(group.id, cleanedMembers, group.person_ids);
  }

  return (
    <div className="panel-overlay sibling-group-panel">
      <div className="panel-header sibling-group-panel__header">
        <h3>{t("siblingGroup.title")}</h3>
        <button type="button" className="panel-close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <div className="sibling-group-panel__count">
        {t("siblingGroup.totalCount", { count: siblingCount })}
      </div>

      <div className="sibling-group-panel__content">
        {group.person_ids.map((personId) => {
          const person = allPersons.get(personId);
          return (
            <div
              key={personId}
              className="sibling-group-panel__card sibling-group-panel__card--person"
            >
              <User size={14} className="sibling-group-panel__card-icon" />
              <div className="sibling-group-panel__card-info">
                <span className="sibling-group-panel__card-name">{person?.name ?? "?"}</span>
                {person?.birth_year != null && (
                  <span className="sibling-group-panel__card-year">{person.birth_year}</span>
                )}
              </div>
              <span className="sibling-group-panel__card-badge">{t("siblingGroup.inTree")}</span>
            </div>
          );
        })}

        {members.map((member) => (
          <div
            key={member._key}
            className="sibling-group-panel__card sibling-group-panel__card--member"
          >
            <div className="sibling-group-panel__card-main">
              <div className="sibling-group-panel__card-row">
                <label className="detail-panel__field" style={{ flex: 1 }}>
                  <span>{t("person.name")}</span>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => handleNameChange(member._key, e.target.value)}
                  />
                </label>
                <label className="detail-panel__field">
                  <span>{t("person.gender")}</span>
                  <select
                    value={member.gender ?? ""}
                    onChange={(e) => handleFieldChange(member._key, "gender", e.target.value)}
                  >
                    <option value="">---</option>
                    <option value="male">{t("person.male")}</option>
                    <option value="female">{t("person.female")}</option>
                    <option value="other">{t("person.other")}</option>
                  </select>
                </label>
              </div>
              <div className="sibling-group-panel__card-row">
                <label className="detail-panel__field">
                  <span>{t("person.birthYear")}</span>
                  <input
                    type="number"
                    value={member.birth_year ?? ""}
                    onChange={(e) => handleFieldChange(member._key, "birth_year", e.target.value)}
                    placeholder="---"
                  />
                </label>
                <label className="detail-panel__field">
                  <span>{t("person.deathYear")}</span>
                  <input
                    type="number"
                    value={member.death_year ?? ""}
                    onChange={(e) => handleFieldChange(member._key, "death_year", e.target.value)}
                    placeholder="---"
                  />
                </label>
              </div>
            </div>
            <div className="sibling-group-panel__card-actions">
              <button
                type="button"
                className="sibling-group-panel__icon-btn"
                title={t("siblingGroup.promote")}
                onClick={() =>
                  onPromote(
                    group.id,
                    members.findIndex((m) => m._key === member._key),
                  )
                }
              >
                <ArrowUpRight size={14} />
              </button>
              <button
                type="button"
                className="sibling-group-panel__icon-btn sibling-group-panel__icon-btn--danger"
                title={t("common.remove")}
                onClick={() => handleRemoveMember(member._key)}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="sibling-group-panel__add-card" onClick={handleAddMember}>
          <Plus size={14} />
          <span>{t("siblingGroup.addMember")}</span>
        </button>
      </div>

      <div className="sibling-group-panel__footer">
        <button type="button" className="btn btn--primary" onClick={handleSave}>
          {t("common.save")}
        </button>
        <button
          type="button"
          className="sibling-group-panel__delete-btn"
          onClick={() => onDelete(group.id)}
        >
          <Trash2 size={12} />
          {t("siblingGroup.deleteGroup")}
        </button>
      </div>
    </div>
  );
}
