import { ArrowUpRight, Plus, Trash2, User, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPerson, DecryptedSiblingGroup } from "../../hooks/useTreeData";
import type { SiblingGroupMember } from "../../types/domain";
import "./SiblingGroupPanel.css";

export interface SiblingGroupPanelProps {
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
  const [members, setMembers] = useState<SiblingGroupMember[]>(() => [...group.members]);

  const totalCount = members.length + group.person_ids.length;

  function handleNameChange(index: number, name: string) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, name } : m)));
  }

  function handleYearChange(index: number, value: string) {
    setMembers((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, birth_year: value ? parseInt(value, 10) : null } : m,
      ),
    );
  }

  function handleAddMember() {
    setMembers((prev) => [...prev, { name: "", birth_year: null }]);
  }

  function handleRemoveMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    onSave(group.id, members, group.person_ids);
  }

  return (
    <div className="sibling-group-panel">
      <div className="sibling-group-panel__header">
        <h3>{t("siblingGroup.title")}</h3>
        <button type="button" className="sibling-group-panel__close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <div className="sibling-group-panel__count">
        {t("siblingGroup.totalCount", { count: totalCount })}
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

        {members.map((member, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: members are edited by index
            key={index}
            className="sibling-group-panel__card sibling-group-panel__card--member"
          >
            <div className="sibling-group-panel__card-inputs">
              <input
                type="text"
                className="sibling-group-panel__input-name"
                value={member.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                placeholder={t("siblingGroup.namePlaceholder")}
              />
              <input
                type="number"
                className="sibling-group-panel__input-year"
                value={member.birth_year ?? ""}
                onChange={(e) => handleYearChange(index, e.target.value)}
                placeholder={t("siblingGroup.yearPlaceholder")}
              />
            </div>
            <div className="sibling-group-panel__card-actions">
              <button
                type="button"
                className="sibling-group-panel__icon-btn"
                title={t("siblingGroup.promote")}
                onClick={() => onPromote(group.id, index)}
              >
                <ArrowUpRight size={14} />
              </button>
              <button
                type="button"
                className="sibling-group-panel__icon-btn sibling-group-panel__icon-btn--danger"
                title={t("common.remove")}
                onClick={() => handleRemoveMember(index)}
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
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--primary"
          onClick={handleSave}
        >
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
