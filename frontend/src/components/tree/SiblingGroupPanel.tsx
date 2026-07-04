import { ArrowUpRight, Plus, Trash2, User, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAutosaveForm } from "../../hooks/useAutosaveForm";
import type { DecryptedPerson, DecryptedSiblingGroup } from "../../hooks/useTreeData";
import type { SiblingGroupMember } from "../../types/domain";
import { blurOnEnter, sanitizeYearInput } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import { InspectorSaveWhisper, useInspectorStatus } from "../inspector/InspectorStatus";
import "./SiblingGroupPanel.css";

type KeyedSiblingGroupMember = SiblingGroupMember & { _key: string };

interface SiblingGroupPanelProps {
  group: DecryptedSiblingGroup;
  allPersons: Map<string, DecryptedPerson>;
  onSave: (
    groupId: string,
    members: SiblingGroupMember[],
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDelete: (groupId: string) => void;
  onPromote: (groupId: string, memberIndex: number) => void;
  onClose: () => void;
}

interface SiblingGroupDraft {
  members: KeyedSiblingGroupMember[];
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
  const { status, report } = useInspectorStatus();

  const { draft, update, updateAndCommit, commit } = useAutosaveForm({
    source: group,
    toDraft: (g): SiblingGroupDraft => ({
      members: g.members.map((m) => ({ ...m, _key: crypto.randomUUID() })),
    }),
    toData: (d) => ({
      members: d.members.map(({ _key, ...rest }) => rest),
    }),
    onSave: (data) => onSave(group.id, data.members, group.person_ids),
    report,
  });

  const members = draft.members;

  // Total people in this sibling set: full-node siblings ("in tree") plus the
  // lightweight members listed below. Matches the cards rendered in the panel.
  const siblingCount = members.length + group.person_ids.length;

  function addMember() {
    updateAndCommit((d) => ({
      members: [...d.members, { name: "", birth_year: null, _key: crypto.randomUUID() }],
    }));
  }

  function patchMember(key: string, patch: Partial<SiblingGroupMember>) {
    update((d) => ({
      members: d.members.map((m) => (m._key === key ? { ...m, ...patch } : m)),
    }));
  }

  return (
    <div className="panel-overlay sibling-group-panel">
      <div className="panel-header sibling-group-panel__header">
        <h3>{t("siblingGroup.title")}</h3>
        <div className="sibling-group-panel__header-actions">
          <InspectorSaveWhisper status={status} />
          <button type="button" className="panel-close" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
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
                <InspectorField label={t("person.name")} className="sibling-group-panel__grow">
                  <input
                    type="text"
                    aria-label={t("person.name")}
                    value={member.name}
                    onChange={(e) => patchMember(member._key, { name: e.target.value })}
                    onBlur={commit}
                    onKeyDown={blurOnEnter}
                  />
                </InspectorField>
                <InspectorField label={t("person.gender")}>
                  <select
                    value={member.gender ?? ""}
                    onChange={(e) =>
                      updateAndCommit((d) => ({
                        members: d.members.map((m) =>
                          m._key === member._key ? { ...m, gender: e.target.value } : m,
                        ),
                      }))
                    }
                  >
                    <option value="">{t("person.datePartEmpty")}</option>
                    <option value="male">{t("person.male")}</option>
                    <option value="female">{t("person.female")}</option>
                    <option value="other">{t("person.other")}</option>
                  </select>
                </InspectorField>
              </div>
              <div className="sibling-group-panel__card-row">
                <InspectorField label={t("person.birthYear")} className="inspector-field--year">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={t("person.birthYear")}
                    value={member.birth_year ?? ""}
                    onChange={(e) => {
                      const value = sanitizeYearInput(e.target.value);
                      patchMember(member._key, {
                        birth_year: value ? parseInt(value, 10) : null,
                      });
                    }}
                    onBlur={commit}
                    onKeyDown={blurOnEnter}
                  />
                </InspectorField>
                <InspectorField label={t("person.deathYear")} className="inspector-field--year">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={t("person.deathYear")}
                    value={member.death_year ?? ""}
                    onChange={(e) => {
                      const value = sanitizeYearInput(e.target.value);
                      patchMember(member._key, {
                        death_year: value ? parseInt(value, 10) : null,
                      });
                    }}
                    onBlur={commit}
                    onKeyDown={blurOnEnter}
                  />
                </InspectorField>
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
                onClick={() =>
                  updateAndCommit((d) => ({
                    members: d.members.filter((m) => m._key !== member._key),
                  }))
                }
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="sibling-group-panel__add-card" onClick={addMember}>
          <Plus size={14} />
          <span>{t("siblingGroup.addMember")}</span>
        </button>
      </div>

      <div className="sibling-group-panel__footer">
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
