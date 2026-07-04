import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { getPatternColor, PATTERN_COLORS } from "../../lib/patternColors";
import {
  buildPersonEntityGroups,
  derivePersonIds,
  type EntityMaps,
  resolveLinkedEntity,
} from "../../lib/patternEntities";
import type { LinkedEntity, Pattern } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { blurOnEnter } from "../inspector/fieldHelpers";
import { InspectorField } from "../inspector/InspectorField";
import {
  InspectorSaveWhisper,
  InspectorStatusProvider,
  useInspectorStatus,
  useSaveReporter,
} from "../inspector/InspectorStatus";
import { useEntityAutosave } from "../inspector/useEntityAutosave";
import "./PatternPanel.css";

interface PatternPanelProps {
  patterns: Map<string, DecryptedPattern>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  persons: Map<string, DecryptedPerson>;
  visiblePatternIds: Set<string>;
  onToggleVisibility: (patternId: string) => void;
  onSave: (
    patternId: string | null,
    data: Pattern,
    personIds: string[],
  ) => Promise<unknown> | undefined;
  onDelete: (patternId: string) => void;
  onClose: () => void;
  onHoverPattern?: (patternId: string | null) => void;
  initialExpandedId?: string | null;
}

interface EntityInfo {
  entity: LinkedEntity;
  label: string;
  personName: string;
  personId: string;
}

export function PatternPanel({
  patterns,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  persons,
  visiblePatternIds,
  onToggleVisibility,
  onSave,
  onDelete,
  onClose,
  onHoverPattern,
  initialExpandedId,
}: PatternPanelProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  const [editingNew, setEditingNew] = useState(false);
  const { status, report } = useInspectorStatus();

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingNew(false);
  }, []);

  const handleStartNew = useCallback(() => {
    setEditingNew(true);
    setExpandedId(null);
  }, []);

  const entityMaps: EntityMaps = useMemo(
    () => ({ events, lifeEvents, turningPoints, classifications, persons }),
    [events, lifeEvents, turningPoints, classifications, persons],
  );

  // Creation collapses the form after Add; edit-mode autosaves keep it open.
  const handleCreate = useCallback(
    (data: Pattern) => {
      const personIds = derivePersonIds(data.linked_entities, entityMaps);
      const result = onSave(null, data, personIds);
      setEditingNew(false);
      return result;
    },
    [entityMaps, onSave],
  );

  const handleAutoSave = useCallback(
    (patternId: string, data: Pattern) => {
      const personIds = derivePersonIds(data.linked_entities, entityMaps);
      return onSave(patternId, data, personIds);
    },
    [entityMaps, onSave],
  );

  const handleDelete = useCallback(
    (patternId: string) => {
      onDelete(patternId);
      setExpandedId(null);
    },
    [onDelete],
  );

  const patternList = useMemo(() => Array.from(patterns.values()), [patterns]);

  return (
    <InspectorStatusProvider value={report}>
      <div className="panel-overlay pattern-panel" data-testid="pattern-panel">
        <div className="panel-header">
          <h2>{t("pattern.patterns")}</h2>
          <div className="pattern-panel__header-actions">
            <InspectorSaveWhisper status={status} />
            <button type="button" className="btn btn--primary" onClick={handleStartNew}>
              {t("pattern.newPattern")}
            </button>
            <button type="button" className="panel-close" onClick={onClose}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div className="pattern-panel__content">
          {editingNew && (
            <div className="pattern-panel__item">
              <PatternEditForm
                pattern={null}
                entityMaps={entityMaps}
                onSave={(_, data) => handleCreate(data)}
                onCancel={() => setEditingNew(false)}
                onDelete={undefined}
              />
            </div>
          )}

          {patternList.length === 0 && !editingNew && (
            <div className="pattern-panel__empty">{t("pattern.empty")}</div>
          )}

          {patternList.map((pattern) => (
            <div
              key={pattern.id}
              className="pattern-panel__item"
              onMouseEnter={() => onHoverPattern?.(pattern.id)}
              onMouseLeave={() => onHoverPattern?.(null)}
            >
              <button
                type="button"
                className="pattern-panel__item-header"
                onClick={() => handleToggleExpand(pattern.id)}
              >
                <div
                  className="pattern-panel__color-dot"
                  style={{ backgroundColor: getPatternColor(pattern.color) }}
                />
                <span className="pattern-panel__item-name">{pattern.name}</span>
                <span className="pattern-panel__item-count">{pattern.linked_entities.length}</span>
                <span
                  role="switch"
                  tabIndex={0}
                  aria-checked={visiblePatternIds.has(pattern.id)}
                  className={`pattern-panel__visibility-btn ${
                    !visiblePatternIds.has(pattern.id)
                      ? "pattern-panel__visibility-btn--hidden"
                      : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(pattern.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleVisibility(pattern.id);
                    }
                  }}
                  aria-label={
                    visiblePatternIds.has(pattern.id) ? t("pattern.visible") : t("pattern.hidden")
                  }
                >
                  {visiblePatternIds.has(pattern.id) ? <Eye size={14} /> : <EyeOff size={14} />}
                </span>
                <ChevronRight
                  size={14}
                  className={`pattern-panel__chevron ${
                    expandedId === pattern.id ? "pattern-panel__chevron--open" : ""
                  }`}
                />
              </button>

              {expandedId === pattern.id && (
                <PatternEditForm
                  key={pattern.id}
                  pattern={pattern}
                  entityMaps={entityMaps}
                  onSave={(patternId, data) =>
                    patternId ? handleAutoSave(patternId, data) : undefined
                  }
                  onCancel={() => setExpandedId(null)}
                  onDelete={() => handleDelete(pattern.id)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </InspectorStatusProvider>
  );
}

interface PatternEditFormProps {
  pattern: DecryptedPattern | null;
  entityMaps: EntityMaps;
  onSave: (patternId: string | null, data: Pattern) => Promise<unknown> | undefined;
  onCancel: () => void;
  onDelete: (() => void) | undefined;
}

interface PatternDraft {
  name: string;
  description: string;
  color: string;
  linkedEntities: LinkedEntity[];
}

function buildPatternData(draft: PatternDraft): Pattern | null {
  if (!draft.name.trim()) return null;
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    color: draft.color,
    linked_entities: draft.linkedEntities,
  };
}

function PatternEditForm({
  pattern,
  entityMaps,
  onSave,
  onCancel,
  onDelete,
}: PatternEditFormProps) {
  const { t } = useTranslation();
  const report = useSaveReporter();
  // The link picker is pure UI state, never persisted.
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const { isNew, draft, update, commit, changeAndCommit, scheduleCommit, buildData } =
    useEntityAutosave({
      entity: pattern,
      toDraft: (p) => ({
        name: p?.name ?? "",
        description: p?.description ?? "",
        color: p?.color ?? PATTERN_COLORS[0],
        linkedEntities: p?.linked_entities ?? [],
      }),
      toData: buildPatternData,
      onAutoSave: (data) => onSave(pattern?.id ?? null, data),
    });

  const linkedEntitySet = useMemo(
    () => new Set(draft.linkedEntities.map((e) => `${e.entity_type}:${e.entity_id}`)),
    [draft.linkedEntities],
  );

  const entityInfos: EntityInfo[] = useMemo(() => {
    return draft.linkedEntities.map((le) => {
      const resolved = resolveLinkedEntity(le, entityMaps, t);
      return { entity: le, ...resolved };
    });
  }, [draft.linkedEntities, entityMaps, t]);

  const personEntityGroups = useMemo(() => buildPersonEntityGroups(entityMaps, t), [entityMaps, t]);

  function handleAdd() {
    const data = buildData();
    if (!data) return;
    const result = onSave(null, data);
    Promise.resolve(result).then(
      () => report?.("saved"),
      () => report?.("error"),
    );
  }

  function addEntity(entityType: LinkedEntity["entity_type"], entityId: string) {
    const key = `${entityType}:${entityId}`;
    if (linkedEntitySet.has(key)) return;
    changeAndCommit((d) => ({
      ...d,
      linkedEntities: [...d.linkedEntities, { entity_type: entityType, entity_id: entityId }],
    }));
  }

  return (
    <div className="pattern-panel__edit">
      <InspectorField label={t("pattern.name")}>
        <input
          type="text"
          aria-label={t("pattern.name")}
          value={draft.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          onBlur={commit}
          onKeyDown={blurOnEnter}
          data-testid="pattern-name-input"
        />
      </InspectorField>

      <InspectorField label={t("pattern.description")}>
        <textarea
          aria-label={t("pattern.description")}
          value={draft.description}
          onChange={(e) => {
            update((d) => ({ ...d, description: e.target.value }));
            scheduleCommit();
          }}
          onBlur={commit}
          rows={3}
        />
      </InspectorField>

      <div className="pattern-panel__field">
        <span>{t("pattern.color")}</span>
        <div className="pattern-panel__colors">
          {PATTERN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`pattern-panel__color-swatch ${
                draft.color === c ? "pattern-panel__color-swatch--selected" : ""
              }`}
              style={{ backgroundColor: getPatternColor(c) }}
              onClick={() => changeAndCommit((d) => ({ ...d, color: c }))}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="pattern-panel__field">
        <span>{t("pattern.linkedEntities")}</span>
        <div className="pattern-panel__entities">
          {entityInfos.map((info, i) => (
            <div
              key={`${info.entity.entity_type}:${info.entity.entity_id}`}
              className="pattern-panel__entity-chip"
            >
              <div
                className={`pattern-panel__entity-type-icon pattern-panel__entity-type-icon--${
                  info.entity.entity_type === "trauma_event"
                    ? "trauma"
                    : info.entity.entity_type === "life_event"
                      ? "life"
                      : info.entity.entity_type === "turning_point"
                        ? "turning-point"
                        : "classification"
                }`}
              />
              <span className="pattern-panel__entity-label">{info.label}</span>
              {info.personName && (
                <span className="pattern-panel__entity-person">{info.personName}</span>
              )}
              <button
                type="button"
                className="pattern-panel__entity-remove"
                onClick={() =>
                  changeAndCommit((d) => ({
                    ...d,
                    linkedEntities: d.linkedEntities.filter((_, idx) => idx !== i),
                  }))
                }
                aria-label={t("pattern.unlinkEntity")}
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn pattern-panel__btn--add"
          onClick={() => setShowLinkPicker((v) => !v)}
        >
          {showLinkPicker ? t("common.close") : t("pattern.linkEntity")}
        </button>

        {showLinkPicker && (
          <div className="pattern-panel__link-section">
            {personEntityGroups.map((group) => (
              <div key={group.personId} className="pattern-panel__link-person">
                <div className="pattern-panel__link-person-name">{group.personName}</div>
                {group.entities.map((entity) => {
                  const isLinked = linkedEntitySet.has(`${entity.type}:${entity.id}`);
                  return (
                    <button
                      type="button"
                      key={`${entity.type}:${entity.id}`}
                      className={`pattern-panel__link-entity ${
                        isLinked ? "pattern-panel__link-entity--linked" : ""
                      }`}
                      onClick={() => !isLinked && addEntity(entity.type, entity.id)}
                      disabled={isLinked}
                    >
                      <div
                        className={`pattern-panel__entity-type-icon pattern-panel__entity-type-icon--${
                          entity.type === "trauma_event"
                            ? "trauma"
                            : entity.type === "life_event"
                              ? "life"
                              : entity.type === "turning_point"
                                ? "turning-point"
                                : "classification"
                        }`}
                      />
                      <span>{entity.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {personEntityGroups.length === 0 && (
              <div className="pattern-panel__empty" style={{ padding: "10px" }}>
                {t("pattern.selectEntities")}
              </div>
            )}
          </div>
        )}
      </div>

      {isNew ? (
        <div className="pattern-panel__form-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleAdd}
            disabled={!draft.name.trim()}
          >
            {t("common.add")}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        onDelete && (
          <div className="inspector-danger">
            <ConfirmDeleteButton
              onConfirm={onDelete}
              label={t("common.delete")}
              confirmLabel={t("pattern.confirmDelete")}
              className="btn btn--danger"
            />
          </div>
        )
      )}
    </div>
  );
}
