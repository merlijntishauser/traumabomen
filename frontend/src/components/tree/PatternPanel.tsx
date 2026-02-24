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
  onSave: (patternId: string | null, data: Pattern, personIds: string[]) => void;
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

  const handleSave = useCallback(
    (patternId: string | null, data: Pattern) => {
      const personIds = derivePersonIds(data.linked_entities, entityMaps);
      onSave(patternId, data, personIds);
      setEditingNew(false);
      setExpandedId(null);
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
    <div className="pattern-panel" data-testid="pattern-panel">
      <div className="pattern-panel__header">
        <h2>{t("pattern.patterns")}</h2>
        <div className="pattern-panel__header-actions">
          <button
            type="button"
            className="pattern-panel__btn pattern-panel__btn--primary"
            onClick={handleStartNew}
          >
            {t("pattern.newPattern")}
          </button>
          <button type="button" className="pattern-panel__close" onClick={onClose}>
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
              onSave={(data) => handleSave(null, data)}
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
            <div
              className="pattern-panel__item-header"
              onClick={() => handleToggleExpand(pattern.id)}
            >
              <div
                className="pattern-panel__color-dot"
                style={{ backgroundColor: getPatternColor(pattern.color) }}
              />
              <span className="pattern-panel__item-name">{pattern.name}</span>
              <span className="pattern-panel__item-count">{pattern.linked_entities.length}</span>
              <button
                type="button"
                className={`pattern-panel__visibility-btn ${
                  !visiblePatternIds.has(pattern.id) ? "pattern-panel__visibility-btn--hidden" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(pattern.id);
                }}
                aria-label={
                  visiblePatternIds.has(pattern.id) ? t("pattern.visible") : t("pattern.hidden")
                }
              >
                {visiblePatternIds.has(pattern.id) ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <ChevronRight
                size={14}
                className={`pattern-panel__chevron ${
                  expandedId === pattern.id ? "pattern-panel__chevron--open" : ""
                }`}
              />
            </div>

            {expandedId === pattern.id && (
              <PatternEditForm
                pattern={pattern}
                entityMaps={entityMaps}
                onSave={(data) => handleSave(pattern.id, data)}
                onCancel={() => setExpandedId(null)}
                onDelete={() => handleDelete(pattern.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PatternEditFormProps {
  pattern: DecryptedPattern | null;
  entityMaps: EntityMaps;
  onSave: (data: Pattern) => void;
  onCancel: () => void;
  onDelete: (() => void) | undefined;
}

function PatternEditForm({
  pattern,
  entityMaps,
  onSave,
  onCancel,
  onDelete,
}: PatternEditFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(pattern?.name ?? "");
  const [description, setDescription] = useState(pattern?.description ?? "");
  const [color, setColor] = useState(pattern?.color ?? PATTERN_COLORS[0]);
  const [linkedEntities, setLinkedEntities] = useState<LinkedEntity[]>(
    pattern?.linked_entities ?? [],
  );
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const linkedEntitySet = useMemo(
    () => new Set(linkedEntities.map((e) => `${e.entity_type}:${e.entity_id}`)),
    [linkedEntities],
  );

  const entityInfos: EntityInfo[] = useMemo(() => {
    return linkedEntities.map((le) => {
      const resolved = resolveLinkedEntity(le, entityMaps, t);
      return { entity: le, ...resolved };
    });
  }, [linkedEntities, entityMaps, t]);

  const personEntityGroups = useMemo(() => buildPersonEntityGroups(entityMaps, t), [entityMaps, t]);

  function handleAddEntity(type: LinkedEntity["entity_type"], id: string) {
    const key = `${type}:${id}`;
    if (linkedEntitySet.has(key)) return;
    setLinkedEntities((prev) => [...prev, { entity_type: type, entity_id: id }]);
  }

  function handleRemoveEntity(index: number) {
    setLinkedEntities((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      color,
      linked_entities: linkedEntities,
    });
  }

  return (
    <div className="pattern-panel__edit">
      <div className="pattern-panel__field">
        <span>{t("pattern.name")}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="pattern-name-input"
        />
      </div>

      <div className="pattern-panel__field">
        <span>{t("pattern.description")}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div className="pattern-panel__field">
        <span>{t("pattern.color")}</span>
        <div className="pattern-panel__colors">
          {PATTERN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`pattern-panel__color-swatch ${
                color === c ? "pattern-panel__color-swatch--selected" : ""
              }`}
              style={{ backgroundColor: getPatternColor(c) }}
              onClick={() => setColor(c)}
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
                onClick={() => handleRemoveEntity(i)}
                aria-label={t("pattern.unlinkEntity")}
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="pattern-panel__btn pattern-panel__btn--add"
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
                    <div
                      key={`${entity.type}:${entity.id}`}
                      className={`pattern-panel__link-entity ${
                        isLinked ? "pattern-panel__link-entity--linked" : ""
                      }`}
                      onClick={() => !isLinked && handleAddEntity(entity.type, entity.id)}
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
                    </div>
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

      <div className="pattern-panel__form-actions">
        <button
          type="button"
          className="pattern-panel__btn pattern-panel__btn--primary"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          {t("common.save")}
        </button>
        <button type="button" className="pattern-panel__btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        {onDelete &&
          (confirmDelete ? (
            <button
              type="button"
              className="pattern-panel__btn pattern-panel__btn--danger"
              onClick={onDelete}
            >
              {t("pattern.confirmDelete")}
            </button>
          ) : (
            <button
              type="button"
              className="pattern-panel__btn pattern-panel__btn--danger"
              onClick={() => setConfirmDelete(true)}
            >
              {t("common.delete")}
            </button>
          ))}
      </div>
    </div>
  );
}
