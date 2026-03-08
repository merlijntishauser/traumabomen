import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedSiblingGroup } from "../../hooks/useTreeData";
import type { SiblingGroupMember } from "../../types/domain";
import "./SiblingGroupPanel.css";

export interface SiblingGroupPanelProps {
  group: DecryptedSiblingGroup;
  onSave: (groupId: string, members: SiblingGroupMember[], personIds: string[]) => void;
  onDelete: (groupId: string) => void;
  onPromote: (groupId: string, memberIndex: number) => void;
  onClose: () => void;
}

export function SiblingGroupPanel({
  group,
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
        {members.map((member, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: members are edited by index
            key={index}
            className="sibling-group-panel__member-row"
          >
            <input
              type="text"
              className="sibling-group-panel__member-name"
              value={member.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              placeholder={t("siblingGroup.namePlaceholder")}
            />
            <input
              type="number"
              className="sibling-group-panel__member-year"
              value={member.birth_year ?? ""}
              onChange={(e) => handleYearChange(index, e.target.value)}
              placeholder={t("siblingGroup.yearPlaceholder")}
            />
            <div className="sibling-group-panel__member-actions">
              <button
                type="button"
                className="detail-panel__btn--small"
                onClick={() => onPromote(group.id, index)}
              >
                {t("siblingGroup.promote")}
              </button>
              <button
                type="button"
                className="detail-panel__btn--small detail-panel__btn--danger"
                onClick={() => handleRemoveMember(index)}
              >
                {t("common.remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sibling-group-panel__footer">
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--secondary"
          onClick={handleAddMember}
        >
          {t("siblingGroup.addMember")}
        </button>
        <div className="sibling-group-panel__footer-actions">
          <button
            type="button"
            className="detail-panel__btn detail-panel__btn--primary"
            onClick={handleSave}
          >
            {t("common.save")}
          </button>
          <button
            type="button"
            className="detail-panel__btn detail-panel__btn--danger"
            onClick={() => onDelete(group.id)}
          >
            {t("siblingGroup.deleteGroup")}
          </button>
        </div>
      </div>
    </div>
  );
}
